<template>
	<div :style="{ height: height, backgroundColor: bgColor }" class="emoji-box">
		<!-- 表情列表 -->
		<ul :style="{ width: width, padding: `${padding}px` }" class="emoji-wrap">
			<li v-for="item in currentEmotionList" :key="`${currentCategory}-${item.id}`" :data-code="item.id" :title="item.text" class="emoji" @click="handleClick(item)">
				<img :alt="item.text" :src="getEmotionImgUrl(item.id)" />
			</li>
		</ul>
		<!-- 底部分类标签 -->
		<div v-if="showCategories" class="emoji-categories">
			<div v-for="(category, index) in categories" :key="category.category" :class="['category-tab', { active: currentCategory === index }]" @click="switchCategory(index)">
				{{ category.category }}
			</div>
		</div>
	</div>
</template>

<script>
import { getAllCategories, getImgUrl } from "@/components/Emotion/emotion";

export default {
	name: "Emotion",
	props: {
		width: {
			type: String,
			default: "100%",
		},
		height: {
			type: String,
			default: "100%",
		},
		bgColor: {
			type: String,
			default: "transparent",
		},
		padding: {
			type: Number,
			default: () => 5,
		},
		showCategories: {
			type: Boolean,
			default: true,
		},
	},
	data() {
		return {
			categories: [],
			currentCategory: 0,
		};
	},
	computed: {
		currentEmotionList() {
			if (this.categories.length > 0 && this.categories[this.currentCategory]) {
				return this.categories[this.currentCategory].emotions;
			}
			return [];
		},
	},
	created() {
		this.loadCategories();
	},
	methods: {
		loadCategories() {
			this.categories = getAllCategories();
			if (this.categories.length === 0) {
				// eslint-disable-next-line no-console
				console.warn("未加载到任何表情分类数据");
			}
		},
		switchCategory(index) {
			this.currentCategory = index;
		},
		handleClick(item) {
			this.$emit("emotion", item);
		},
		getEmotionImgUrl(id) {
			return getImgUrl(id);
		},
	},
};
</script>

<style lang="less" scoped>
.emoji-box {
	border-radius: 5px;
	overflow: hidden;
	display: flex;
	flex-direction: column;

	.emoji-wrap {
		overflow-y: auto;
		flex: 1;

		.emoji {
			float: left;
			margin: 5px;
			padding: 3px;
			border-radius: 5px;
			border: 1px solid @message-hover-bg-color;
			background: @message-hover-bg-color;
			display: flex;
			align-items: center;
			justify-content: center;
			transition: all 0.2s ease-in-out;
			cursor: pointer;
			-webkit-user-drag: none;

			img {
				transition: all 0.2s ease-in-out;
				width: 30px;
				height: 30px;
				-webkit-user-drag: none;
				pointer-events: none;
				user-select: none;
			}

			&:hover {
				background: @message-hover-bg-color;
				img {
					transform: scale(1.2);
				}
			}
		}
	}

	.emoji-categories {
		display: flex;
		padding: 3px 10px;
		gap: 5px;
		border-top: 1px solid @message-border-color;
		flex-shrink: 0;
		background: transparent;
		color: #999;

		.category-tab {
			padding: 5px 10px;
			cursor: pointer;
			user-select: none;
			transition: all 0.3s;
			font-size: 13px;
			text-align: center;
			border-radius: 5px;

			&:hover {
				background: @message-hover-bg-color;
			}

			&.active {
				background: @message-hover-bg-color;
				color: @message-main-text-color;
			}
		}
	}
}
</style>
