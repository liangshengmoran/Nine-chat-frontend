<template>
	<div class="online">
		<div v-for="(item, index) in on_line_user_list" :key="index" :class="['online-item', { current: mine(item.id) }]">
			<img class="online-item-avatar" :src="item && item.user_avatar" />
			<div class="online-item-info">
				<div class="online-item-info-name">
					<span>{{ item.user_nick }}</span>
					<span
						v-if="getRoleLabel(item)"
						class="role"
						:style="{
              backgroundColor: getRoleBgColor(item),
            }"
					>
						{{ getRoleLabel(item) }}
					</span>
				</div>
				<div class="online-item-info-desc s-1-line">
					{{ item.user_sign }}
				</div>
			</div>
		</div>
	</div>
</template>

<script>
import { mapGetters } from "vuex";

export default {
  name: "OnLineInfo",
  computed: {
    ...mapGetters(["room_admin_id", "on_line_user_list", "mine_id"]),
    mine() {
      return (id) => this.mine_id === id;
    },
  },
  methods: {
    /* 获取角色标签文本 */
    getRoleLabel(item) {
      if (item.user_role === 'super') return '超级管理员';
      if (item.user_role === 'admin') return '管理员';
      if (item.id === this.room_admin_id) return '房主';
      return '';
    },
    /* 获取角色背景颜色 */
    getRoleBgColor(item) {
      if (item.user_role === 'super') return '#d4af37'; // 金色
      if (item.user_role === 'admin') return '#d4af37'; // 金色
      if (item.id === this.room_admin_id) return '#9b59b6'; // 紫色
      return '#ccc';
    },
  },
};
</script>

<style lang="less" scoped>
.online {
  display: flex;
  flex-direction: column;
  height: 440px;
  overflow: hidden;
  overflow-y: auto;
  &-item {
    cursor: pointer;
    padding: 10px;
    display: flex;
    align-items: center;
    border-top: 1px solid @message-border-color;
    transition: all 0.3s;
    border-left: 3px solid transparent;
    border-right: 3px solid transparent;
    padding-left: 8px;
    position: relative;
    &:hover {
      border-left: 3px solid #1295dd;
    }
    &-avatar {
      width: 40px;
      height: 40px;
      border-radius: 5px;
      margin-right: 10px;
    }
    &-info {
      display: flex;
      flex-direction: column;
      flex: 1;
      width: 0;
      &-name {
        font-size: 14px;
        color: @message-main-text-color;
        font-weight: 500;
        display: flex;
        justify-content: space-between;
        align-items: center;
        .role {
          background-color: #ccc;
          font-size: 12px;
          color: #fff;
          padding: 1px 3px;
          margin-right: 3px;
          border-radius: 3px;
        }
      }
      &-desc {
        font-size: 12px;
        margin-top: 8px;
        color: #aaa;
        text-align: left;
      }
    }
  }
}
.current {
  border-right-color: #521cd373;
}
</style>
