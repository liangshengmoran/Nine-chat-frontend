<template>
	<div v-loading="loading" class="choose">
		<div class="choose-header">
			<input ref="input" v-model="params.keyword" type="text" :placeholder="searchPlaceholder" @keydown.enter="search" />
			<div class="choose-header-btn" @click="search">
				<icon name="toolbar-search" class="m_r5" scale="1.6" />
				搜索
			</div>
		</div>
		<!-- 音源选择按钮 -->
		<div class="choose-source">
			<div v-for="s in sources" :key="s.key" :class="['source-tab', { active: currentSource === s.key }]" @click="switchSource(s.key)">
				<icon :name="s.icon" scale="1" />
				{{ s.label }}
			</div>
		</div>
		<div class="choose-content">
			<div v-if="!isShowMusic" class="choose-content-empty" @click="focus">
				<icon name="choose-music-empty" class="icon" scale="16" />
				<span class="tips">请输入关键词搜索歌曲</span>
			</div>

			<div v-if="isShowMusic" class="choose-content-music">
				<div v-for="(item, index) in musicList" :key="index" class="music">
					<img v-if="item.music_cover" :src="item.music_cover" alt="item.name" class="music-pic" />
					<img v-if="item.music_pic" :src="item.music_pic" alt="item.name" class="music-pic" />
					<div class="music-info">
						<div class="music-info-name">
							{{ item.music_name }}
							<span :class="['music-source-tag', item.source || currentSource]">
								{{ (item.source || currentSource) === 'netease' ? '网易' : '酷狗' }}
							</span>
						</div>
						<div class="music-info-desc s-1-line">歌手：{{ item.music_singer }} 专辑:{{ item.music_album }}</div>
					</div>
					<div class="music-btn" @click="chooseMusic(item)"><icon name="choose-music-play" class="m_r5" scale="1.6" />点歌</div>
					<div class="music-btn" @click="loveMusic(item)"><icon name="choose-music-love" class="m_r5" scale="1.6" />收藏</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script>
import { mapGetters } from "vuex";
import { search, collectMusic, hot } from "@/api/music";

export default {
  data() {
    return {
      isShowMusic: false,
      musicList: [],
      loading: false,
      currentSource: 'kugou',
      sources: [
        { key: 'kugou', label: '酷狗', icon: 'choose-music-play' },
        { key: 'netease', label: '网易', icon: 'choose-music-love' }
      ],
      params: {
        page: 1,
        pagesize: 90,
        keyword: "",
        source: "kugou"
      },
    };
  },
  computed: {
    ...mapGetters(["room_admin_id"]),
    searchPlaceholder() {
      return this.currentSource === 'netease'
        ? '在网易云音乐中搜索...'
        : '歌手/歌名/专辑搜索...';
    }
  },
  mounted() {
    this.focus();
  },
  created() {
    this.queryHotMusic();
  },
  methods: {
    /* 切换音源 */
    switchSource(source) {
      if (this.currentSource === source) return;
      this.currentSource = source;
      this.params.source = source;
      // 如果有搜索关键词，切换后自动重新搜索
      if (this.params.keyword) {
        this.search();
      }
    },
    /* 光标到输入框 */
    focus() {
      this.$refs.input.focus();
    },
    /* 搜索歌曲 */
    async search() {
      try {
        if (!this.params.keyword) return;
        this.loading = true;
        const res = await search(this.params);
        this.loading = false;
        this.musicList = res.data;
        this.isShowMusic = true;
      } catch (error) {
        this.loading = false;
      }
    },
    /* 客户端点歌请求 */
    chooseMusic(musicInfo) {
      // 确保携带 source 信息
      const info = { ...musicInfo, source: musicInfo.source || this.currentSource };
      this.$socket.client.emit("chooseMusic", info);
    },
    /* 默认展示当前房间房主收藏的歌曲列表 */
    async loveMusic(musicInfo) {
      // 确保携带 source 信息
      const info = { ...musicInfo, source: musicInfo.source || this.currentSource };
      await collectMusic(info);
      this.$message.success("收藏歌曲成功！");
    },
    /* 获取热门歌曲 */
    async queryHotMusic() {
      const res = await hot({ user_id: this.room_admin_id });
      this.isShowMusic = true;
      this.musicList = res.data;
    },
  },
};
</script>
<style lang="less" scoped>
.choose {
  padding: 0 15px;
  border-top: 1px solid @message-border-color;

  /* 音源选择按钮 */
  &-source {
    display: flex;
    justify-content: flex-start;
    gap: 6px;
    padding: 0 0 6px 0;

    .source-tab {
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 11px;
      color: #999;
      cursor: pointer;
      transition: all 0.2s;
      border: 1px solid @message-border-color;
      user-select: none;

      &:hover {
        color: #666;
        border-color: #ccc;
      }

      &.active {
        color: #409eff;
        background: rgba(64, 158, 255, 0.1);
        border-color: rgba(64, 158, 255, 0.4);
      }
    }
  }

  &-header {
    display: flex;
    justify-content: center;
    align-items: center;
    border: 1px solid @message-border-color;
    transition: all 0.3s;
    font-size: 13px;
    color: #999;
    border-radius: 5px;
    margin: 7px 0;
    input {
      padding: 8px 16px;
      flex: 1;
      font-size: 13px;
      outline: none;
      border: none;
      color: #999;
      background: transparent;
      &::placeholder {
        color: #ccc;
        font-size: 14px;
      }
    }
    &-btn {
      padding: 9px 18px;
      border-left: 1px solid @message-border-color;
      user-select: none;
      display: flex;
      align-items: center;
      cursor: pointer;
      transition: all 0.3s;
      &:hover {
        filter: brightness(0.8);
        border-left: 1px solid transparent;
      }
      &:active {
        filter: brightness(1.2);
        transform: scale(1.2);
      }
    }
  }

  &-content {
    height: 250px;
    user-select: none;
    overflow: hidden;
    overflow-y: auto;
    &-empty {
      padding: 25px 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      .icon {
        margin-bottom: 20px;
      }
      .tips {
        user-select: none;
        color: @message-main-text-color;
      }
    }
    .music {
      display: flex;
      align-items: center;
      border-top: 1px solid @message-border-color;
      padding: 10px 0;
      &-pic {
        width: 40px;
        height: 40px;
        border-radius: 10px;
      }
      &-info {
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        margin-left: 8px;
        flex: 1;
        width: 0;
        &-name {
          font-size: 14px;
          color: @message-main-text-color;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        &-desc {
          font-size: 12px;
        }
      }
      &-source-tag {
        font-size: 10px;
        padding: 1px 6px;
        border-radius: 3px;
        font-weight: 500;

        &.kugou {
          background: rgba(64, 158, 255, 0.15);
          color: #409eff;
        }

        &.netease {
          background: rgba(230, 77, 77, 0.15);
          color: #e64d4d;
        }
      }
      &-btn {
        user-select: none;
        padding: 5px 10px;
        margin: 0 2px;
        border-radius: 5px;
        cursor: pointer;
        color: @message-main-text-color;
        display: flex;
        align-items: center;
        .icon {
          margin-right: 3px;
        }
        &:hover {
          background: message-hover-bg-color;
        }
        &:active {
          filter: brightness(1.2);
          color: #000;
        }
      }
    }
  }
}
</style>
