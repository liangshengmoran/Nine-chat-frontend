<template>
	<div id="box" class="message-box">
		<div v-for="(item, index) in displayMessageList" :key="item._key || index" :ref="`message__${item.id || -1}`" :class="['message-box-item', messageClass(item)]">
			<!-- 系统消息折叠提示 - 放在第一个可见info消息之前 -->
			<div v-if="item.isCollapseBar" class="info-collapse-bar" @click="toggleInfoCollapse">
				<icon name="chat-panel-link" scale="1.2" />
				<span v-if="infoCollapsed">已隐藏 {{ hiddenInfoCount }} 条系统消息，点击展开</span>
				<span v-else>点击收起系统消息</span>
			</div>
			<!-- text  'notice', 'info' 类型分别代表公告和中间的提示消息不在此处显示-->
			<span v-if="item.message_type && !tipsMessageType.includes(item.message_type) && !item.isCollapseBar" class="message-box-item-info">
				<el-dropdown trigger="click" placement="bottom" size="mini" @command="handlerMessageCommand($event, item)">
					<div class="info-box">
						<span :class="['name', getUserRoleClass(item)]">
							{{ item.user_info && item.user_info.user_nick }}
							<!-- 超级管理员标签 -->
							<span v-if="item.user_info && item.user_info.user_role === 'super'" class="role-tag super-tag">超管</span>
							<!-- 管理员标签 -->
							<span v-else-if="item.user_info && item.user_info.user_role === 'admin'" class="role-tag admin-tag">管理</span>
							<!-- 房主标签（可与超管/管理组合） -->
							<span v-if="item.user_info && item.user_info.id === room_admin_id" class="role-tag owner-tag">房主</span>
							<!-- 房管标签（版主，排除超管/管理/房主） -->
							<span v-if="item.user_info && item.user_info.is_moderator && !['super', 'admin'].includes(item.user_info.user_role) && item.user_info.id !== room_admin_id" class="role-tag moderator-tag"
								>房管</span
							>
							<!-- Bot 机器人图标 -->
							<icon v-if="item.user_info && item.user_info.is_bot" name="robot_label" scale="2" class="bot-icon" />
						</span>

						<!-- 文字消息 (Markdown) -->
						<span
							v-if="item.message_type === 'text' && item.parse_mode === 'markdown' && !isUrl(item.message_content)"
							:class="['message', 'markdown-body', textClass(item), { 'mention-highlight': isMentioned(item) }]"
							v-html="renderMarkdown(item.message_content)"
						></span>
						<!-- 文字消息 (HTML) -->
						<span
							v-else-if="item.message_type === 'text' && item.parse_mode === 'html' && !isUrl(item.message_content)"
							:class="['message', textClass(item), { 'mention-highlight': isMentioned(item) }]"
							v-html="sanitizeHtml(item.message_content)"
						></span>
						<!-- 文字消息 (普通) -->
						<span
							v-else-if="item.message_type === 'text' && !isUrl(item.message_content)"
							:class="['message', textClass(item), { 'mention-highlight': isMentioned(item) }]"
							v-html="replaceEmotionText(item.message_content)"
						></span>
						<!-- 链接地址 -->
						<a v-if="item.message_type === 'text' && isUrl(item.message_content)" :href="item.message_content" target="_blank" :class="['message', 'msg-url']" @click.stop>
							<icon name="chat-panel-link" scale="1.8" />
							{{ item.message_content }}
						</a>
						<!-- 图片消息 -->
						<span v-if="imgMessageType.includes(item.message_type)" :class="['msg-img', { 'msg-emo': item.message_type === 'emo' }]">
							<img :ref="`img__${item.id}`" :src="item.message_content.url" @click="previewImg(item)" />
						</span>
						<!-- Bot 文件消息 -->
						<span v-if="item.message_type === 'file'" class="msg-file-bot">
							<div class="msg-file-bot-panel">
								<icon name="chat-frame-unknow-file" scale="3" class="file-icon" />
								<div class="file-detail">
									<a :href="getFileContent(item).file_url" target="_blank" class="file-name">{{ getFileContent(item).file_name }}</a>
									<span v-if="getFileContent(item).caption" class="file-caption">{{ getFileContent(item).caption }}</span>
								</div>
							</div>
						</span>
						<!-- 非图片的类型的其他信息 不包含公告提示和文字图片等所有类型 -->
						<span v-if="otherFileType(item.message_type)" class="msg-other">
							<div class="msg-other-panel">
								<div class="file-info">
									<span class="file-info-name">{{
                    item.message_content.name
									}}</span>
									<span class="file-info-size">{{
                    item.message_content.size
									}}</span>
								</div>
								<icon class="file-icon" name="chat-frame-unknow-file" scale="4" />
							</div>
						</span>
						<!--  引用消息 -->
						<span
							v-if="item.quote_info"
							:class="[
                'quote-panel',
                { recall: item.quote_info.quote_message_status === -1 },
              ]"
							@click.stop="handlerJumpMessage(item.quote_info.quote_message_id)"
						>
							<span v-if="item.quote_info.quote_message_status === 1" style="margin: 5px">{{ item.quote_info.quote_user_nick }}:</span>
							<!-- 引用消息已被撤回 -->
							<span v-if="item.quote_info.quote_message_status === -1"> 引用消息已被撤回</span>
							<!-- 文字消息引用 -->
							<span
								v-if="
                  item.quote_info.quote_message_type === 'text' &&
                  item.quote_info.quote_message_status === 1
                "
							>
								{{ item.quote_info.quote_message_content }}</span
							>
							<!-- 图片消息引用 包含表情包 -->
							<img
								v-if="
                  imgMessageType.includes(item.quote_info.quote_message_type) &&
                  item.quote_info.quote_message_status === 1
                "
								:src="item.quote_info.quote_message_content.url"
								class="message-img"
							/>
							<!-- 特殊格式文件引用 -->
							<span
								v-if="
                  otherFileType(item.quote_info.quote_message_type) &&
                  item.quote_info.quote_message_status === 1
                "
								class="msg-other quote-msg-other"
							>
								<div class="msg-other-panel">
									<div class="file-info">
										<span class="file-info-name">{{
                      item.quote_info.quote_message_content.name
										}}</span>
										<span class="file-info-size">{{
                      item.quote_info.quote_message_content.size
										}}</span>
									</div>
									<icon class="file-icon" name="chat-frame-unknow-file" scale="4" />
								</div>
							</span>
						</span>

						<!-- 已编辑标记 -->
						<span v-if="item.edited" class="edited-tag">(已编辑)</span>
						<!-- Inline Keyboard 按钮 -->
						<div v-if="item.reply_markup && item.reply_markup.inline_keyboard" class="inline-keyboard">
							<div v-for="(row, ri) in item.reply_markup.inline_keyboard" :key="ri" class="inline-keyboard-row">
								<button v-for="(btn, bi) in row" :key="bi" class="inline-keyboard-btn" @click.stop="handleInlineKeyboardClick(item, btn)">{{ btn.text }}</button>
							</div>
						</div>
						<!-- 时间 -->
						<span class="time">{{ formatChatTime(item.createdAt) }}</span>
					</div>
					<span>
						<el-dropdown-menu slot="dropdown">
							<el-dropdown-item icon="el-icon-chat-line-square" command="1">引用消息</el-dropdown-item>
							<el-dropdown-item v-if="item.user_info && item.user_info.id === mine_id" icon="el-icon-delete" command="2">撤回消息</el-dropdown-item>
							<el-dropdown-item
								v-if="
                  imgMessageType.includes(item.message_type) &&
                  item.message_type !== 'emo'
                "
								icon="el-icon-search"
								command="3"
								>预览大图</el-dropdown-item
							>
							<el-dropdown-item v-if="otherFileType(item.message_type)" icon="el-icon-download" command="4">下载文件</el-dropdown-item>
						</el-dropdown-menu>
					</span>
				</el-dropdown>

				<!-- 用户可能删除账户的情况就没有item.user_info了 -->
				<img v-if="item.user_info" class="avatar" :src="item.user_info.user_avatar" />
				<img v-if="!item.user_info" class="avatar" :src="errAvatar" />
			</span>

			<!-- info -->
			<span v-if="item.message_type === 'info'" class="msg">
				{{ item.message_content }}
			</span>

			<!-- notice -->
			<span v-if="item.message_type === 'notice'" class="notice-box">
				<div class="notice-box-header">
					<span class="title">房间公告</span>
				</div>
				<div v-for="(t, i) in item.message_content" :key="i">{{ t }}</div>
			</span>
		</div>

		<!-- Bot 正在输入提示 -->
		<div v-if="botTypingInfo" class="bot-typing-indicator">
			<span class="typing-dots"><span></span><span></span><span></span></span>
			{{ botTypingInfo.bot_name }} 正在输入...
		</div>

		<div id="panelEnd" ref="end"></div>
	</div>
</template>

<script>
import { mapGetters, mapMutations, mapState } from "vuex";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { replaceEmotionText } from "@/components/Emotion/emotion.js";
import { throttle, formatChatTime } from "@/utils/tools";

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true,
});

export default {
  props: {
    /* 是否还有历史数据，是否还能上拉加载 */
    stopLoadmore: {
      type: Boolean,
      default: true,
    },
  },
  data() {
    return {
      isVisible: true, // 是否在可视区域
      unReadNum: 0, // 未读消息条数
      firstNodeId: 0,
      imgMessageType: ["png", "jpg", "jpeg", "gif", "emo"], // emo 是特殊类型的表情包 也属于图片
      tipsMessageType: ["notice", "info"], // 中间显示的类型 目前有公搞和一些进出切歌房间这类提示
      errAvatar:
        "https://img1.baidu.com/it/u=430660535,1172956011&fm=253&fmt=auto&app=138&f=JPEG?w=500&h=500",
      infoCollapsed: true, // 系统消息是否折叠
      maxVisibleInfoMessages: 3, // 折叠时显示的最大info消息数
      collapseTimer: null, // 自动折叠定时器
    };
  },
  computed: {
    ...mapState(["messageList", "un_read_msg_num", "botTypingInfo"]),
    ...mapGetters(["mine_id", "room_admin_id"]),

    /* 获取所有info类型消息 */
    allInfoMessages() {
      return this.messageList.filter(m => m && m.message_type === 'info');
    },

    /* 计算被隐藏的info消息数量 */
    hiddenInfoCount() {
      if (!this.infoCollapsed) return 0;
      const total = this.allInfoMessages.length;
      return Math.max(0, total - this.maxVisibleInfoMessages);
    },

    /* 过滤后的消息列表，折叠时只显示最近的N条info消息，并在第一个可见info前插入折叠栏 */
    displayMessageList() {
      // 过滤掉 undefined 元素
      const validMessages = this.messageList.filter(m => m && typeof m === 'object');

      // 找出所有info消息的索引
      const infoIndices = [];
      validMessages.forEach((m, i) => {
        if (m && m.message_type === 'info') {
          infoIndices.push(i);
        }
      });

      // 如果info消息数量小于等于最大显示数，不需要折叠栏
      if (infoIndices.length <= this.maxVisibleInfoMessages) {
        return validMessages;
      }

      if (!this.infoCollapsed) {
        // 展开状态：显示所有消息，但在第一个info消息前插入折叠栏
        const firstInfoIdx = infoIndices[0];
        const result = [];
        validMessages.forEach((m, i) => {
          if (i === firstInfoIdx) {
            // 在第一个info消息前插入折叠栏
            result.push({ isCollapseBar: true, collapseKey: 'collapse-bar' });
          }
          result.push(m);
        });
        return result;
      }

      // 折叠状态：隐藏部分info消息，并在第一个可见info前插入折叠栏
      const hideIndices = new Set(infoIndices.slice(0, -this.maxVisibleInfoMessages));
      const firstVisibleInfoIdx = infoIndices[infoIndices.length - this.maxVisibleInfoMessages];

      const result = [];
      validMessages.forEach((m, i) => {
        if (hideIndices.has(i)) {
          return; // 跳过隐藏的info消息
        }
        if (i === firstVisibleInfoIdx) {
          // 在第一个可见的info消息前插入折叠栏
          result.push({ isCollapseBar: true, collapseKey: 'collapse-bar' });
        }
        result.push(m);
      });

      return result;
    },

    messageClass() {
      return (item) => {
        // 折叠栏特殊处理
        if (item.isCollapseBar) return 'collapse-bar-item';
        const { user_id, message_type } = item;
        if (!["info", "notice"].includes(message_type)) {
          return user_id === this.mine_id ? "mine" : "other";
        }
        return message_type;
      };
    },

    textClass() {
      return (item) => {
        if (!item.user_info) return;
        const { user_role, id } = item.user_info;
        if (['super', 'admin'].includes(user_role)) return "admin-text";
        if (this.room_admin_id === id) return "homeowner";
      };
    },

    /* 获取用户角色的样式类 */
    getUserRoleClass() {
      return (item) => {
        if (!item.user_info) return '';
        const { user_role, id, is_bot } = item.user_info;
        if (is_bot) return 'bot-name';  // Bot 特殊样式
        if (['super', 'admin'].includes(user_role)) return 'super-admin-name';
        if (this.room_admin_id === id) return 'room-admin-name';
        return '';
      };
    },

    /* 不属于文字，图片，提示等类型的其他格式消息 */
    otherFileType() {
      return (type) => ![
          ...this.imgMessageType,
          ...this.tipsMessageType,
          "text",
          "file",
        ].includes(type);
    },

    /* 检测是不是URL地址 */
    isUrl() {
      return (text) => {
        const reg =
          /(http|ftp|https):\/\/[\w\-_]+(\.[\w\-_]+)+([\w\-\.,@?^=%&:/~\+#]*[\w\-\@?^=%&/~\+#])?/;
        return reg.test(text);
      };
    },
  },
  watch: {
    /* 来了新消息并且在450范围内就直接滚动到消息查看，否则提示未读消息数量 */
    messageList(n, o) {
      if (!n.length) return;
      const isOneMsg = n.length - o.length === 1; // 是否本次增加了一条消息

      /*  记录旧的数据第一个id可以拿到所有消息的最顶部那条消息id 然后拿到节点 */
      const lastNodeId = o.length > 10 && o[0] ? o[0].id : 0;

      /* 当不是在可视区域并且一次不止一条消息加入队列的情况说明是上拉刷新 */
      if (!this.isVisible && !isOneMsg) {
        /* 加载完成后将历史消息的第一条置于可视区域即可 */
        this.$nextTick(() => {
          this.$refs[`message__${lastNodeId}`][0].scrollIntoView();
        });
      }
      /* 增加一条消息的时候窗口滚动才添加动画 批量增加可能是初始化或者 上拉加载 不需要动画 */
      const params = isOneMsg ? { behavior: "smooth" } : {};
      this.$nextTick(() => this.isVisible && this.toEnd(params));

      /* 不在可是区域并且增加了一条消息 提示未读消息+1 */
      !this.isVisible &&
        isOneMsg &&
        this.setUnReadMsgNum(this.un_read_msg_num + 1);

      /* 如果展开状态下有新消息，3秒后自动折叠 */
      if (!this.infoCollapsed && isOneMsg) {
        this.startAutoCollapseTimer();
      }
    },

    stopLoadmore(n) {
      n &&
        document
          .querySelector(`#box`)
          .removeEventListener("scroll", this.scrollToTop);
    },
  },
  mounted() {
    const panel = document.querySelector(`#box`);
    panel.addEventListener("scroll", this.scrollToTop);
    this.$once("hook:beforeDestory", () =>
      panel.removeEventListener("scroll", this.scrollToTop)
    );
  },
  methods: {
    ...mapMutations(["setMessageDataList", "setUnReadMsgNum", "setPreImg"]),
    replaceEmotionText,
    formatChatTime,

    /* 切换系统消息折叠状态 */
    toggleInfoCollapse() {
      this.infoCollapsed = !this.infoCollapsed;
      // 展开时启动自动折叠定时器
      if (!this.infoCollapsed) {
        this.startAutoCollapseTimer();
      } else {
        this.clearAutoCollapseTimer();
      }
    },

    /* 启动自动折叠定时器 */
    startAutoCollapseTimer() {
      this.clearAutoCollapseTimer();
      this.collapseTimer = setTimeout(() => {
        this.infoCollapsed = true;
      }, 3000);
    },

    /* 清除自动折叠定时器 */
    clearAutoCollapseTimer() {
      if (this.collapseTimer) {
        clearTimeout(this.collapseTimer);
        this.collapseTimer = null;
      }
    },
    /**
     * @desc 监听窗口确定是否跳转到底部
     *       1. 初始化的时候默认在消息底部
     *       2. 在视窗高度450内的时候有消息自动滑到底部
     *       3. 在视窗450以上说明去看历史消息了 这个时候不到底部 提示有新消息
     *       4. 在显示有新消息的时候 再次到底部新消息提示消失
     */
    scrollToTop: throttle(function () {
      const el = document.querySelector(`#box`);
      const {scrollTop} = el;
      const {scrollHeight} = el;

      /* 是否在可是区域  */
      this.isVisible = el.offsetHeight + scrollTop - scrollHeight > -450;

      /* 滑到可视区域那么未读消息自动变为0 */
      this.isVisible && this.setUnReadMsgNum(0);

      /* 快到顶部了加载更多消息 */
      if (scrollTop < 30 && this.messageList.length > 0) {
        this.loadHistoryMessage();
      }
    }, 200),

    loadHistoryMessage() {
      this.$emit("loadHistoryMessage");
    },

    /* 滚动到底部 */
    toEnd(params) {
      this.$nextTick(() =>
        document.getElementById("panelEnd").scrollIntoView(params)
      );
    },
    previewImg() {},

    /* 下拉菜单 */
    handlerMessageCommand(val, message) {
      if (Number(val) === 1) return this.$emit("quoteMessage", message);
      if (Number(val) === 2)
        return this.$socket.client.emit("recallMessage", {
          id: message.id,
          user_nick: message.user_info.user_nick,
        });
      if (Number(val) === 3) return this.handlerPreBigImg(message);
      if (Number(val) === 4) return this.handlerDownLiad(message);
    },

    /* 点击引用消息滚动到引用消息位置 */
    handlerJumpMessage(id) {
      const isHasMessage = this.messageList.filter((t) => t.id === id).length;
      if (!isHasMessage)
        return this.$message.warning("当前消息在历史消息中，还没加载出来呢！");
      this.$refs[`message__${id}`][0].scrollIntoView({ behavior: "smooth" });
    },

    /* 预览大图 */
    handlerPreBigImg(message) {
      const { width, height } = this.$refs[`img__${message.id}`][0];
      this.setPreImg({
        url: message.message_content.url,
        width: width * 2,
        height: height * 2,
      });
    },

    /* 下载 */
    handlerDownLiad(message) {
      const { url } = message.message_content;
      const link = document.createElement("a"); // 自己创建的a标签
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },

    /* Markdown 渲染 */
    renderMarkdown(content) {
      try {
        const text = typeof content === 'string' ? content : JSON.stringify(content);
        const html = marked(text);
        return DOMPurify.sanitize(html);
      } catch (e) {
        return content;
      }
    },

    /* HTML 消息安全过滤 */
    sanitizeHtml(content) {
      return DOMPurify.sanitize(typeof content === 'string' ? content : '');
    },

    /* 解析文件消息内容 */
    getFileContent(item) {
      try {
        return typeof item.message_content === 'string'
          ? JSON.parse(item.message_content)
          : item.message_content;
      } catch (e) {
        return { file_url: '', file_name: '未知文件', caption: '' };
      }
    },

    /* 检测当前用户是否被 @提及 */
    isMentioned(item) {
      if (!item.mentions || !item.mentions.length) return false;
      return item.mentions.includes(this.mine_id);
    },

    /* Inline Keyboard 按钮点击 */
    handleInlineKeyboardClick(message, btn) {
      if (btn.url) {
        window.open(btn.url, '_blank');
        return;
      }
      if (btn.callback_data) {
        this.$socket.client.emit('callbackQuery', {
          message_id: message.id,
          bot_id: message.user_info?.bot_id,
          data: btn.callback_data,
        });
      }
    },
  },
};
</script>
<style lang="less" scoped>
.message-box {
  padding: 20px;
  box-sizing: border-box;
  height: 100%;
  overflow-y: scroll;
  // overflow: overlay;
  display: flex;
  flex-direction: column;
  position: relative;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: block;
    width: 5px;
    height: 5px;
  }
  &::-webkit-scrollbar-thumb {
    border-radius: 1em;
    background-color: rgba(50, 50, 50, 0.3);
  }
  &::-webkit-scrollbar-track {
    border-radius: 1em;
    background-color: rgba(50, 50, 50, 0.1);
  }

  /* 系统消息折叠栏 */
  .info-collapse-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px 12px;
    margin: 5px auto;
    background: rgba(100, 100, 100, 0.1);
    border-radius: 15px;
    font-size: 11px;
    color: #999;
    cursor: pointer;
    user-select: none;
    transition: all 0.2s;
    max-width: 280px;

    &:hover {
      background: rgba(100, 100, 100, 0.2);
      color: #666;
    }
  }

  &-item {
    display: flex;
    margin: 7px 0;
    &-info {
      display: flex;
      .info-box {
        display: flex;
        flex-direction: column;
        .message {
          font-size: 13px;
          padding: 4px 16px;
          border-radius: 6px;
          margin-top: 10px;
          cursor: pointer;
          text-align: justify;
          line-height: 2;
          max-width: 300px;
          word-break: break-all;
        }
        /* 引用消息 */
        .quote-panel {
          cursor: pointer;
          margin-top: 5px;
          background: @message-panel-tips-bg-color;
          color: #868181;
          display: flex;
          align-items: center;
          padding: 5px 15px;
          border-radius: 5px;
          position: relative;
          word-break: break-all;
          max-width: 350px;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
          user-select: none;
          .message-img {
            max-height: 75px;
            border: 1px solid #b6b6b6;
            border-radius: 3px;
          }
        }
        /* 撤回消息 */
        .recall {
          background: #868181;
          color: #e1e1e1;
        }
        .time {
          font-size: 12px;
          color: #9f9898;
          margin-top: 5px;
        }
        .msg-img {
          display: flex;
          justify-content: center;
          align-items: center;
          margin-top: 10px;
          /* 图片图片 */
          img {
            max-width: 220px;
            border-radius: 10px;
            object-fit: cover;
            cursor: pointer;
            user-select: none;
            -webkit-user-drag: none;
            border: 1px solid #b6b6b6;
          }
        }
        /* 特殊格式文件 */
        .msg-other {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #fff;
          padding: 10px 20px;
          min-width: 140px;
          border-radius: 3px;
          margin-top: 10px;
          filter: brightness(0.9);
          &-panel {
            display: flex;
            justify-content: space-between;
            width: 100%;
            cursor: pointer;
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
          &:hover {
            filter: brightness(1);
          }
        }
        .quote-msg-other {
          background: #e2e2e2;
          padding: 6px 10px;
          margin-top: 0;
          &:hover {
            filter: brightness(0.9);
          }
        }
        /* 表情包 */
        .msg-emo img {
          user-select: none;
          max-width: 100px;
          -webkit-user-drag: none;
        }
        /* 连接地址 */
        .msg-url {
          color: blue !important;
          cursor: pointer;
        }
        .name {
          font-size: 14px;
          color: @message-main-text-color;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        /* 超级管理员昵称 */
        .super-admin-name {
          color: #d4af37;
          font-weight: bold;
        }
        /* 房间管理员昵称 */
        .room-admin-name {
          color: #9b59b6;
          font-weight: bold;
        }
        /* 角色标签样式 */
        .role-tag {
          font-size: 10px;
          padding: 1px 4px;
          border-radius: 3px;
          margin-left: 4px;
          font-weight: normal;
        }
        .super-tag {
          background: linear-gradient(135deg, #d4af37 0%, #f5d76e 100%);
          color: #fff;
          box-shadow: 0 1px 3px rgba(212, 175, 55, 0.4);
        }
        .admin-tag {
          background: linear-gradient(135deg, #3498db 0%, #5dade2 100%);
          color: #fff;
          box-shadow: 0 1px 3px rgba(52, 152, 219, 0.4);
        }
        .owner-tag {
          background: linear-gradient(135deg, #9b59b6 0%, #bb8fce 100%);
          color: #fff;
          box-shadow: 0 1px 3px rgba(155, 89, 182, 0.4);
        }
        .moderator-tag {
          background: linear-gradient(135deg, #27ae60 0%, #58d68d 100%);
          color: #fff;
          box-shadow: 0 1px 3px rgba(39, 174, 96, 0.4);
        }
        /* Bot 机器人图标 */
        .bot-icon {
          margin-left: 4px;
          vertical-align: middle;
          filter: drop-shadow(0 1px 2px rgba(0, 133, 255, 0.4));
        }
        /* Bot 昵称样式 */
        .bot-name {
          background: linear-gradient(135deg, #0085ff, #00c6ff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          font-weight: 700;
        }
      }

      .avatar {
        width: 50px;
        height: 50px;
        border-radius: 6px;
      }
    }
  }
}
.mine {
  color: #000;
  justify-content: flex-end;
  .message-box-item-info {
    flex-direction: row;
    .info-box {
      align-items: flex-end;
      margin-right: 20px;
      .message {
        background-color: #a9e87a;
        color: #000;
        font-size: 14px;
      }
    }
  }
}
.other {
  justify-content: flex-start;
  .message-box-item-info {
    flex-direction: row-reverse;
    .info-box {
      align-items: flex-start;
      margin-left: 20px;
      .message {
        background-color: #eee;
        color: #000;
      }
    }
  }
}
.info {
  justify-content: center;
  .msg {
    font-size: 12px;
    color: #aaa;
    display: inline-block;
    background-color: @message-panel-tips-bg-color;
    padding: 2px 8px;
    border-radius: 3px;
    max-width: 500px;
  }
}
.notice {
  justify-content: center;
  &-box {
    text-align: left;
    max-width: 500px;
    background: @message-panel-tips-bg-color;
    padding: 10px 15px;
    border-radius: 10px;
    color: #999;
    font-size: 13px;
    display: flex;
    flex-direction: column;
    letter-spacing: 3px;
    &-header {
      display: flex;
      .title {
        font-size: 16px;
        color: #1295dd;
        display: inline-block;
        border-bottom: 2px dotted #1295dd;
        margin-bottom: 10px;
        padding-bottom: 5px;
      }
    }
  }
}

/* admin-text */
.admin-text {
  background: #000 !important;
  color: #fff !important;
}

/* homeowner */
.homeowner {
  background: #f0bc77 !important;
  color: #fff !important;
}

/* Inline Keyboard 按钮 */
.inline-keyboard {
  margin-top: 8px;
  &-row {
    display: flex;
    gap: 6px;
    margin-bottom: 5px;
  }
  &-btn {
    flex: 1;
    padding: 7px 14px;
    border: none;
    border-radius: 8px;
    background: linear-gradient(135deg, rgba(0, 133, 255, 0.12) 0%, rgba(0, 198, 255, 0.12) 100%);
    color: #0085ff;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.25s ease;
    &:hover {
      background: linear-gradient(135deg, #0085ff 0%, #00c6ff 100%);
      color: #fff;
      transform: translateY(-1px);
      box-shadow: 0 3px 10px rgba(0, 133, 255, 0.3);
    }
    &:active {
      transform: translateY(0) scale(0.97);
      box-shadow: 0 1px 4px rgba(0, 133, 255, 0.2);
    }
  }
}

/* Bot 文件消息 */
.msg-file-bot {
  margin-top: 8px;
  &-panel {
    display: flex;
    align-items: center;
    gap: 12px;
    background: linear-gradient(135deg, rgba(0, 133, 255, 0.06) 0%, rgba(0, 198, 255, 0.06) 100%);
    padding: 12px 16px;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 133, 255, 0.08);
    transition: all 0.25s ease;
    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 14px rgba(0, 133, 255, 0.15);
    }
    .file-icon {
      color: #0085ff;
      flex-shrink: 0;
      filter: drop-shadow(0 1px 2px rgba(0, 133, 255, 0.3));
    }
    .file-detail {
      display: flex;
      flex-direction: column;
      gap: 4px;
      .file-name {
        color: inherit;
        font-weight: 500;
        text-decoration: none;
        word-break: break-all;
        &:hover {
          text-decoration: underline;
        }
      }
      .file-caption {
        font-size: 12px;
        color: #999;
      }
    }
  }
}

/* Bot 正在输入 */
.bot-typing-indicator {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  margin: 4px 15px;
  font-size: 12px;
  color: #666;
  background: linear-gradient(135deg, rgba(0, 133, 255, 0.06) 0%, rgba(0, 198, 255, 0.08) 100%);
  border-radius: 16px;
  backdrop-filter: blur(6px);
  animation: fadeInUp 0.3s ease;
  .typing-dots {
    display: flex;
    gap: 3px;
    span {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: linear-gradient(135deg, #0085ff, #00c6ff);
      animation: botBounce 1.4s infinite ease-in-out both;
      &:nth-child(1) { animation-delay: -0.32s; }
      &:nth-child(2) { animation-delay: -0.16s; }
    }
  }
}
@keyframes botBounce {
  0%, 80%, 100% { transform: scale(0); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 已编辑标记 */
.edited-tag {
  font-size: 11px;
  color: #bbb;
  margin-top: 2px;
}

/* @提及高亮 */
.mention-highlight {
  box-shadow: 0 0 0 2px rgba(255, 193, 7, 0.5);
  border-radius: 6px;
}

/* Markdown 消息样式 */
.markdown-body {
  ::v-deep p { margin: 0 0 4px; }
  ::v-deep code {
    background: rgba(0,0,0,0.06);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 12px;
  }
  ::v-deep pre {
    background: rgba(0,0,0,0.06);
    padding: 8px;
    border-radius: 4px;
    overflow-x: auto;
    code { background: none; padding: 0; }
  }
  ::v-deep ul, ::v-deep ol { padding-left: 16px; margin: 4px 0; }
  ::v-deep blockquote {
    margin: 4px 0;
    padding-left: 10px;
    border-left: 3px solid #ccc;
    color: #888;
  }
  ::v-deep h1, ::v-deep h2, ::v-deep h3 { margin: 4px 0; }
  ::v-deep a { color: #0085ff; }
}
</style>
