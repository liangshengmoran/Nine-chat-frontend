<template>
	<div class="message-frame">
		<chat-toolbar ref="toolbar" @emotion="handlerEmotion" />
		<!-- Bot 命令建议下拉 -->
		<div v-if="showCommandMenu" class="command-menu">
			<div v-for="cmd in filteredCommands" :key="cmd.fullCommand" class="command-item" @mousedown.prevent="selectCommand(cmd)">
				<span class="command-name">/{{ cmd.command }}</span>
				<span class="command-desc">{{ cmd.description }}</span>
				<span class="command-bot">{{ cmd.bot_name }}</span>
			</div>
			<div v-if="filteredCommands.length === 0" class="command-empty">没有匹配的命令</div>
		</div>
		<div :class="['message-frame-input']">
			<!-- 图片类型文件 -->
			<img v-if="fileInfo && allowImgExt.includes(fileInfo.ext)" :class="['message-frame-input-img']" :src="preImgBlob" alt="" />
			<!-- 非图片类型文件 -->
			<div v-if="fileInfo && !allowImgExt.includes(fileInfo.ext)">
				<div class="other-file-panel">
					<div class="file-info">
						<span class="file-info-name">{{ fileInfo.name }}</span>
						<span class="file-info-size">{{ fileInfo.size }}</span>
					</div>
					<icon class="file-icon" name="chat-frame-unknow-file" scale="4" />
				</div>
			</div>
			<!-- 文字消息 -->
			<textarea ref="messageInput" v-model.trim="message" placeholder="点击回车键发送消息" class="message-frame-input-text" @keydown="sendMsg" @paste="pasting" @input="onInputChange" />
		</div>
		<div v-if="quoteMessage" class="quote" @click="focusInput">
			<span class="quote-panel">
				<span> {{ quoteMessage.user_info.user_nick }}: </span>
				<!-- 引用文字类型 -->
				<span v-if="quoteMessage.message_type === 'text'">
					{{ quoteMessage.message_content }}
				</span>
				<!-- 引用图片类消息 -->
				<img v-if="allowImgExt.includes(quoteMessage.message_type)" class="message-img" :src="quoteMessage.message_content.url" />
				<!-- 引用非图片类型文件 -->
				<div
					v-if="
            !allowImgExt.includes(quoteMessage.message_type) &&
            quoteMessage.message_type !== 'text'
          "
					class="other-file-panel"
				>
					<div class="file-info">
						<span class="file-info-name">{{
              quoteMessage.message_content.name
						}}</span>
						<span class="file-info-size">{{
              quoteMessage.message_content.size
						}}</span>
					</div>
					<icon class="file-icon" name="chat-frame-unknow-file" scale="4" />
				</div>
			</span>
			<icon name="char-frame-del" scale="1.8" class="del-icon" @click.stop="handlerDelQuoteMessage" />
		</div>
		<div class="message-frame-empty" @click="focusInput"></div>
	</div>
</template>

<script>
import axios from "axios";
import { mapState } from "vuex";
import ChatToolbar from "@/components/Chat/ChatToolbar";
import { getRoomBotCommands } from "@/api/chat";

const file_upload_url = `${process.env.VUE_APP_BASE_API}/upload/file`
export default {
  components: { ChatToolbar },
  data() {
    return {
      message: "",
      quoteMessage: null,
      preImgBlob: null,
      allowImgExt: ["png", "jpg", "jpeg", "gif", "emo"], // 这些是我们允许的图片类型 emo 是我自定义类型 表示表情
      filename: null,
      fileInfo: null,
      loading: false,
      botCommands: [], // Bot命令列表 [{ command, description, bot_name, fullCommand }]
      showCommandMenu: false, // 是否显示命令建议
    };
  },
  computed: {
    ...mapState(["room_id"]),
    filteredCommands() {
      if (!this.message || !this.message.startsWith('/')) return this.botCommands;
      const input = this.message.slice(1).toLowerCase();
      if (!input) return this.botCommands;
      return this.botCommands.filter(cmd => cmd.command.toLowerCase().startsWith(input));
    },
  },
  watch: {
    room_id: {
      immediate: true,
      handler(val) {
        if (val) this.fetchBotCommands(val);
      },
    },
    /* TODO 粘贴图片时导致粘贴完文件名会拼接到input value后，暂未解决，先特殊处理 */
    message(n, o) {
      if (this.filename && n.includes(this.filename)) return (this.message = o);
    },
  },
  methods: {
    async sendMsg(e) {
      if (!this.$socket.client.connected)
        return this.$message.error("请重新登录！");
      /* enter发送将区分文件类型，或者文件加文字一起发送 */
      if (e.keyCode === 13) {
        if (this.loading) return;
        this.loading = true;
        /* 如果只要文字消息，没有资源文件[图片|非图片]就直接发送一条文字消息即可 */
        if (this.message && !this.fileInfo) {
          const data = {
            message_type: "text",
            message_content: JSON.stringify(this.message),
          };
          this.quoteMessage && (data.quote_message = this.quoteMessage);
          this.$socket.client.emit("message", data);
        }
        /* 如果没有文字消息，只有资源文件[图片|其他文件],那么我们先上传文件到服务器拿到资源文件地址，再对ws发送消息 */
        if (!this.message && this.fileInfo) {
          const { name, file, ext, size } = this.fileInfo;
          const formData = new FormData();
          formData.append("file", file);
          const config = { headers: { "Content-Type": "multipart/form-data" } };
          const res = await axios.post(
            file_upload_url,
            formData,
            config
          );
          /* 非文字型消息都按这个格式来序列化 */
          const content = { name, size, ext, url: res.data.data };
          const data = {
            message_type: ext,
            message_content: JSON.stringify(content),
          };
          this.quoteMessage && (data.quote_message = this.quoteMessage);
          this.$socket.client.emit("message", data);
        }

        /* 如果既有文字消息 也有图片消息那么就分为两条消息,先发图片后发文字 */
        if (this.message && this.fileInfo) {
          const { name, file, ext, size } = this.fileInfo;
          const formData = new FormData();
          formData.append("file", file);
          const config = { headers: { "Content-Type": "multipart/form-data" } };
          try {
            const res = await axios.post(
              file_upload_url,
              formData,
              config
            );
            const fileContent = { name, size, ext, url: res.data.data[0].url };
            /* 先发图片消息 */
            this.$socket.client.emit("message", {
              message_type: ext,
              message_content: JSON.stringify(fileContent),
            });
            /* 再发文字消息 如果有引用消息只给文字即可 */
            const data = {
              message_type: "text",
              message_content: JSON.stringify(this.message),
            };
            this.quoteMessage && (data.quote_message = this.quoteMessage);
            this.$socket.client.emit("message", data);
          } catch (error) {
            this.$message.error("图片上传失败，请联系管理员！");
          }
        }

        /* 置空所有状态 */
        this.clearData();

        /* TODO 发送了消息就让面板滚动到底部 此处由于图片加载异步导致没有到达真正的底部，待处理 */
        this.$nextTick(() => this.$scorllToBottom());
        this.loading = false;
        e.preventDefault();
      }

      /* 删除文字，当没有文字的时候，去删除掉复制的图片和文件 */
      if (e.keyCode === 8) {
        if (this.message) return;
        this.preImgBlob = null;
        this.filename = null;
        this.fileInfo = null;
      }
    },

    /* 赞贴文件到输入框 */
    pasting(e) {
      if (e.clipboardData.files.length) {
        this.focusInput();
        const file = e.clipboardData.files[0];
        this.filename = file.name;
        if (file.size > 1024 * 500)
          return this.$message.warning(
            "因服务器资源有限，禁止上传大于500k的资源！"
          );
        const ext = this.getFileType(file.name);
        /* 区分类型后续功能扩展 */
        this.allowImgExt.includes(ext) && this.handlerPastingImg(file, ext);
        !this.allowImgExt.includes(ext) &&
          this.handlerPastingOtherFile(file, ext);
      }
    },

    /* 发送完消息清空对象 */
    clearData() {
      this.message = '';
      this.quoteMessage = null;
      this.preImgBlob = null;
      this.fileInfo = null;
      this.filename = null;
    },

    /* 处理粘贴图片类型 */
    handlerPastingImg(file, ext) {
      const { name, size } = file;
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        this.preImgBlob = e.target.result;
        this.fileInfo = { file, name, ext, size: this.formatSeize(size) };
      };
    },

    /* 处理粘贴的其他类型文件 */
    handlerPastingOtherFile(file, ext) {
      const { name, size } = file;
      this.fileInfo = { file, name, ext, size: this.formatSeize(size) };
    },

    /* 用户选择表情包 */
    handlerEmotion(emoji) {
      this.message += `[${emoji.text}]`;
    },

    /* 打开不同面板框 */
    openBox(val) {
      this.$refs.toolbar.openBox(val);
    },

    /* 聚焦输入框 */
    focusInput() {
      this.$refs.messageInput.focus();
    },

    /* 引用消息 */
    setQuoteMessage(message) {
      this.quoteMessage = message;
      this.$refs.messageInput.focus();
    },

    /* 清楚引用消息 */
    handlerDelQuoteMessage() {
      this.quoteMessage = null;
    },

    /* TODO 获取文件类型 放入全局 */
    getFileType(name) {
      return name.substr(name.lastIndexOf(".") - name.length + 1).toLowerCase();
    },

    /* 格式化文件大小，目前我们限制500k， 只需要格式化k即可， 如果你改变限制文件大小了，这里也得改 */
    formatSeize(size) {
      return size > 1024 ? `${(size / 1024).toFixed(1)}k` : `${size}b`;
    },

    /* 获取房间Bot命令 */
    async fetchBotCommands(roomId) {
      try {
        const res = await getRoomBotCommands({ room_id: roomId });
        const bots = res.data || res || [];
        const commands = [];
        (Array.isArray(bots) ? bots : []).forEach((bot) => {
          if (bot.commands && Array.isArray(bot.commands)) {
            bot.commands.forEach((cmd) => {
              commands.push({
                command: cmd.command,
                description: cmd.description,
                bot_name: bot.bot_name,
                fullCommand: `/${  cmd.command}`,
              });
            });
          }
        });
        this.botCommands = commands;
      } catch (e) {
        this.botCommands = [];
      }
    },

    /* 输入变化时检测是否显示命令菜单 */
    onInputChange() {
      const raw = this.$refs.messageInput ? this.$refs.messageInput.value : '';
      this.showCommandMenu = raw.startsWith('/') && this.botCommands.length > 0;
    },

    /* 选择命令 */
    selectCommand(cmd) {
      this.message = `${cmd.fullCommand  } `;
      this.showCommandMenu = false;
      this.$refs.messageInput.focus();
    },
  },
};
</script>
<style lang="less" scoped>
.message-frame {
  height: 160px;
  display: flex;
  flex-direction: column;
  width: 100%;
  position: relative;
  .progress {
    width: 100%;
    height: 2px;
  }
  &-input {
    display: flex;
    padding: 0 15px;
    overflow: hidden;
    &-img {
      object-fit: cover;
      border: 1px solid #b6b6b6;
      border-radius: 3px;
      max-width: 320px;
    }
    &-text {
      width: 100%;
      overflow: hidden;
      box-sizing: border-box;
      resize: none;
      outline: none;
      border: none;
      font-size: 15px;
      color: @message-main-text-color;
      background-color: transparent;
    }
  }
  &-empty {
    flex: 1;
  }
  .minHeight {
    min-height: 60px;
  }
  .quote {
    padding: 0 15px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    margin-top: 5px;
    &-panel {
      background: #e5e5e5;
      color: #868181;
      display: flex;
      padding: 5px 15px;
      border-radius: 5px;
      position: relative;
      word-break: break-all;
      .message-img {
        max-height: 50px;
      }
    }
    .del-icon {
      color: #868181;
      margin-left: 12px;
      cursor: pointer;
      flex-shrink: 0;
      &:hover {
        transition: all 0.3s;
        transform: scale(1.2);
      }
    }
  }
}

.maxHeight60 {
  max-height: 60px;
}

.maxHeight100 {
  max-height: 100px;
}

/* 非文字图片类型其他文件 */
.other-file-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  padding: 10px 20px;
  min-width: 140px;
  border-radius: 3px;
  filter: brightness(0.8);
  .file-info {
    display: flex;
    flex-direction: column;
    &-name {
      color: #807d7d;
      max-width: 90px;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
    }
    &-size {
      margin-top: 5px;
      color: #ccc;
      font-size: 12px;
    }
  }
  .file-icon {
    margin-left: 30px;
  }
}

/* Bot 命令建议菜单 */
.command-menu {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 133, 255, 0.12);
  border-radius: 12px 12px 0 0;
  box-shadow: 0 -4px 20px rgba(0, 133, 255, 0.1), 0 -1px 3px rgba(0, 0, 0, 0.06);
  max-height: 220px;
  overflow-y: auto;
  z-index: 100;
  .command-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    cursor: pointer;
    transition: all 0.2s ease;
    border-left: 2px solid transparent;
    &:hover {
      background: linear-gradient(90deg, rgba(0, 133, 255, 0.08) 0%, transparent 100%);
      border-left-color: #0085ff;
    }
    &:first-child {
      border-radius: 12px 12px 0 0;
    }
    .command-name {
      background: linear-gradient(135deg, #0085ff, #00c6ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-weight: 700;
      font-size: 14px;
      min-width: 80px;
    }
    .command-desc {
      color: #666;
      font-size: 13px;
      flex: 1;
    }
    .command-bot {
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 3px;
      background: linear-gradient(135deg, rgba(0, 133, 255, 0.1), rgba(0, 198, 255, 0.1));
      color: #0085ff;
      white-space: nowrap;
      font-weight: 500;
    }
  }
  .command-empty {
    padding: 14px;
    color: #aaa;
    font-size: 13px;
    text-align: center;
  }
}
</style>
