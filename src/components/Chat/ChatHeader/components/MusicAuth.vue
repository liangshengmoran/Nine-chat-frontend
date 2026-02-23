<template>
	<div class="music-auth">
		<!-- 平台选择 Tab -->
		<div class="auth-tabs">
			<div :class="['auth-tab', { active: activeSource === 'kugou' }]" @click="activeSource = 'kugou'">酷狗音乐</div>
			<div :class="['auth-tab', { active: activeSource === 'netease' }]" @click="activeSource = 'netease'">网易云音乐</div>
		</div>

		<!-- 当前授权状态 -->
		<div v-if="currentAuth.authorized" class="auth-status">
			<div class="auth-status-info">
				<img v-if="currentAuth.avatar" :src="currentAuth.avatar" class="auth-avatar" />
				<div v-else class="auth-avatar-placeholder">
					{{ activeSource === 'kugou' ? '酷' : '云' }}
				</div>
				<div class="auth-detail">
					<div class="auth-nickname">{{ currentAuth.nickname }}</div>
					<div class="auth-time">授权于 {{ formatTime(currentAuth.created_at) }}</div>
				</div>
			</div>
			<el-button type="danger" size="mini" plain @click="handleRevoke">撤销</el-button>
		</div>
		<div v-else class="auth-status auth-status-empty">
			<span>未授权，使用全局默认账号</span>
		</div>

		<!-- 授权方式切换 -->
		<div class="auth-method-tabs">
			<div :class="['method-tab', { active: authMethod === 'cookie' }]" @click="authMethod = 'cookie'">手动输入</div>
			<div :class="['method-tab', { active: authMethod === 'qr' }]" @click="switchToQr">扫码登录</div>
		</div>

		<!-- Cookie 输入模式 -->
		<div v-if="authMethod === 'cookie'" class="auth-cookie">
			<div class="cookie-tips">
				<template v-if="activeSource === 'kugou'"> 请输入酷狗 Cookie（格式：<code>token=xxx;userid=xxx</code>） </template>
				<template v-else> 请输入网易云音乐完整 Cookie </template>
			</div>
			<el-input v-model="cookieInput" type="textarea" :rows="3" :placeholder="activeSource === 'kugou' ? 'token=xxx;userid=xxx' : '粘贴浏览器 Cookie...'" />
			<div class="cookie-action">
				<el-button type="primary" size="small" :loading="submitting" @click="submitCookie"> 提交授权 </el-button>
			</div>
		</div>

		<!-- 二维码扫码模式 -->
		<div v-else class="auth-qr">
			<div class="qr-container">
				<div v-if="qrLoading" class="qr-loading">
					<i class="el-icon-loading" />
					<span>生成二维码中...</span>
				</div>
				<div v-else-if="qrExpired" class="qr-expired" @click="initQrLogin">
					<i class="el-icon-refresh" />
					<span>二维码已过期，点击刷新</span>
				</div>
				<div v-else-if="qrSuccess" class="qr-success">
					<i class="el-icon-circle-check" />
					<span>授权成功</span>
				</div>
				<template v-else>
					<img v-if="qrImage" :src="qrImage" class="qr-image" />
				</template>
			</div>
			<div :class="['qr-status', qrStatusType]">{{ qrStatusText }}</div>
		</div>
	</div>
</template>

<script>
import { mapState } from "vuex";
import {
	musicAuthSubmitCookie,
	musicAuthRevoke,
	musicAuthStatus,
	musicAuthQrKey,
	musicAuthQrCreate,
	musicAuthQrCheck,
} from "@/api/music";

export default {
	name: "MusicAuth",
	data() {
		return {
			activeSource: "kugou",
			authMethod: "cookie",
			cookieInput: "",
			submitting: false,
			authStatus: { kugou: { authorized: false }, netease: { authorized: false } },
			qrKey: null,
			qrImage: null,
			qrLoading: false,
			qrExpired: false,
			qrSuccess: false,
			qrStatusText: "",
			qrStatusType: "waiting",
			qrPollTimer: null,
		};
	},
	computed: {
		...mapState(["room_id", "user_info"]),
		currentAuth() {
			return this.authStatus[this.activeSource] || { authorized: false };
		},
	},
	watch: {
		activeSource() {
			this.stopQrPoll();
			this.qrImage = null;
			this.qrExpired = false;
			this.qrSuccess = false;
			if (this.authMethod === "qr") {
				this.initQrLogin();
			}
		},
	},
	created() {
		this.fetchAuthStatus();
	},
	beforeDestroy() {
		this.stopQrPoll();
	},
	methods: {
		async fetchAuthStatus() {
			try {
				const res = await musicAuthStatus({ room_id: this.room_id });
				this.authStatus = res.data || res;
			} catch (e) {
				// ignore
			}
		},
		async submitCookie() {
			if (!this.cookieInput.trim()) {
				return this.$message.warning("请输入 Cookie");
			}
			this.submitting = true;
			try {
				await musicAuthSubmitCookie({
					room_id: this.room_id,
					source: this.activeSource,
					cookie: this.cookieInput.trim(),
				});
				this.$message.success("授权成功！");
				this.cookieInput = "";
				this.fetchAuthStatus();
			} catch (e) {
				this.$message.error(e.message || "授权失败");
			} finally {
				this.submitting = false;
			}
		},
		async handleRevoke() {
			try {
				await this.$confirm("撤销后将使用全局默认账号", "确认撤销", { type: "warning" });
				await musicAuthRevoke({ room_id: this.room_id, source: this.activeSource });
				this.$message.success("已撤销授权");
				this.fetchAuthStatus();
			} catch (e) {
				// cancelled
			}
		},
		switchToQr() {
			this.authMethod = "qr";
			this.initQrLogin();
		},
		async initQrLogin() {
			this.qrLoading = true;
			this.qrExpired = false;
			this.qrSuccess = false;
			this.qrImage = null;
			this.stopQrPoll();
			try {
				const keyRes = await musicAuthQrKey({ source: this.activeSource });
				const keyData = keyRes.data || keyRes;
				this.qrKey =
					keyData.data?.qrcode || keyData.data?.unikey || keyData.data?.key || keyData.unikey || keyData.key;
				if (!this.qrKey) throw new Error("获取Key失败");
				const qrRes = await musicAuthQrCreate({ key: this.qrKey, source: this.activeSource, qrimg: true });
				const qrData = qrRes.data || qrRes;
				this.qrImage = qrData.data?.base64 || qrData.data?.qrcode_img || qrData.data?.qrimg || "";
				if (!this.qrImage) throw new Error("生成二维码失败");
				this.qrStatusText = `请使用${this.activeSource === "kugou" ? "酷狗" : "网易云"}App 扫码`;
				this.qrStatusType = "waiting";
				this.startQrPoll();
			} catch (e) {
				this.qrExpired = true;
				this.qrStatusText = "二维码生成失败，点击重试";
				this.qrStatusType = "error";
			} finally {
				this.qrLoading = false;
			}
		},
		startQrPoll() {
			this.stopQrPoll();
			this.qrPollTimer = setInterval(() => this.checkQrStatus(), 2000);
		},
		stopQrPoll() {
			if (this.qrPollTimer) {
				clearInterval(this.qrPollTimer);
				this.qrPollTimer = null;
			}
		},
		async checkQrStatus() {
			try {
				const res = await musicAuthQrCheck({
					key: this.qrKey,
					source: this.activeSource,
					room_id: this.room_id,
					user_id: this.user_info?.id,
				});
				const data = res.data || res;
				if (this.activeSource === "kugou") {
					const status = data.data?.status ?? data.status;
					if (status === 0) {
						this.qrExpired = true;
						this.qrStatusText = "二维码已过期，点击刷新";
						this.qrStatusType = "error";
						this.stopQrPoll();
					} else if (status === 1) {
						this.qrStatusText = "等待扫码...";
						this.qrStatusType = "waiting";
					} else if (status === 2) {
						this.qrStatusText = "扫码成功，请在App确认";
						this.qrStatusType = "scanning";
					} else if (status === 4 || status === 3) {
						this.qrSuccess = true;
						this.qrStatusText = "授权登录成功";
						this.qrStatusType = "success";
						this.stopQrPoll();
						this.fetchAuthStatus();
					}
				} else {
					const code = data.code ?? data.data?.code;
					if (code === 800) {
						this.qrExpired = true;
						this.qrStatusText = "二维码已过期，点击刷新";
						this.qrStatusType = "error";
						this.stopQrPoll();
					} else if (code === 801) {
						this.qrStatusText = "等待扫码...";
						this.qrStatusType = "waiting";
					} else if (code === 802) {
						this.qrStatusText = "扫码成功，请在App确认";
						this.qrStatusType = "scanning";
					} else if (code === 803) {
						this.qrSuccess = true;
						this.qrStatusText = "授权登录成功";
						this.qrStatusType = "success";
						this.stopQrPoll();
						this.fetchAuthStatus();
					}
				}
			} catch (e) {
				// ignore
			}
		},
		formatTime(t) {
			if (!t) return "";
			const d = new Date(t);
			return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
		},
	},
};
</script>

<style lang="less" scoped>
.music-auth {
	padding: 10px 15px;
	color: @message-main-text-color;
}

.auth-tabs {
	display: flex;
	gap: 8px;
	margin-bottom: 12px;
}
.auth-tab {
	flex: 1;
	padding: 8px 0;
	text-align: center;
	border-radius: 6px;
	cursor: pointer;
	font-size: 13px;
	background: @message-hover-bg-color;
	transition: all 0.2s;
	&.active {
		background: rgba(64, 158, 255, 0.2);
		color: #409eff;
		font-weight: 600;
	}
	&:hover:not(.active) {
		background: @message-border-color;
	}
}

.auth-status {
	background: @message-hover-bg-color;
	border-radius: 8px;
	padding: 10px 12px;
	margin-bottom: 12px;
	display: flex;
	align-items: center;
	justify-content: space-between;
}
.auth-status-empty {
	justify-content: center;
	color: #999;
	font-size: 13px;
}
.auth-status-info {
	display: flex;
	align-items: center;
	gap: 10px;
}
.auth-avatar {
	width: 36px;
	height: 36px;
	border-radius: 50%;
	object-fit: cover;
}
.auth-avatar-placeholder {
	width: 36px;
	height: 36px;
	border-radius: 50%;
	background: linear-gradient(135deg, #409eff, #67c23a);
	display: flex;
	align-items: center;
	justify-content: center;
	color: #fff;
	font-weight: bold;
	font-size: 14px;
}
.auth-detail {
	.auth-nickname {
		font-size: 14px;
		font-weight: 500;
	}
	.auth-time {
		font-size: 11px;
		color: #999;
		margin-top: 2px;
	}
}

.auth-method-tabs {
	display: flex;
	gap: 6px;
	margin-bottom: 10px;
}
.method-tab {
	flex: 1;
	padding: 6px 0;
	text-align: center;
	border-radius: 4px;
	cursor: pointer;
	font-size: 12px;
	background: @message-hover-bg-color;
	transition: all 0.2s;
	&.active {
		background: rgba(64, 158, 255, 0.15);
		color: #409eff;
	}
	&:hover:not(.active) {
		background: @message-border-color;
	}
}

.auth-cookie {
	.cookie-tips {
		font-size: 12px;
		color: #999;
		margin-bottom: 8px;
		code {
			background: @message-hover-bg-color;
			padding: 1px 4px;
			border-radius: 3px;
			font-size: 11px;
		}
	}
	.cookie-action {
		margin-top: 8px;
		text-align: right;
	}
}

.auth-qr {
	text-align: center;
}
.qr-container {
	width: 180px;
	height: 180px;
	margin: 0 auto 10px;
	border-radius: 8px;
	background: #fff;
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
}
.qr-image {
	width: 100%;
	height: 100%;
	object-fit: contain;
}
.qr-loading, .qr-expired {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;
	font-size: 12px;
	color: #999;
	i { font-size: 24px; }
}
.qr-expired {
	cursor: pointer;
	&:hover { color: #409eff; }
}
.qr-success {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;
	color: #67c23a;
	font-weight: 600;
	i { font-size: 36px; }
}
.qr-status {
	font-size: 13px;
	padding: 4px 0;
	&.waiting { color: #909399; }
	&.scanning { color: #e6a23c; }
	&.success { color: #67c23a; }
	&.error { color: #f56c6c; }
}
</style>
