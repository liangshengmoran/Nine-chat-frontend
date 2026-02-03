// 动态加载所有表情分类数据
const emotionCategories = [];
const emotionMap = {};
const emotionImages = {};

// 自动加载所有JSON文件
function loadEmotionData() {
	try {
		const dataContext = require.context('@/components/Emotion/emotionData', false, /\.json$/);

		dataContext.keys().forEach(key => {
			const categoryData = dataContext(key);
			emotionCategories.push({
				category: categoryData.category,
				emotions: categoryData.emotions
			});

			// 构建表情映射表，key格式: "分类:文本" 和 "文本"（兼容旧格式）
			categoryData.emotions.forEach(item => {
				const fullKey = `${categoryData.category}:${item.text}`;
				emotionMap[fullKey] = item.id;

				// 为了兼容性，也保留纯文本映射（可能会被覆盖，以最后加载的为准）
				if (!emotionMap[item.text]) {
					emotionMap[item.text] = item.id;
				}
			});
		});

		// eslint-disable-next-line no-console
		console.log(`成功加载 ${emotionCategories.length} 个表情分类`);
	} catch (error) {
		// eslint-disable-next-line no-console
		console.warn('表情数据加载失败:', error);
	}
}

// 加载表情图片
function loadEmotionImages() {
	try {
		const emotionContext = require.context('@/components/Emotion/emotionImgs', false, /\.(gif|png|jpg|jpeg)$/i);
		emotionContext.keys().forEach(key => {
			const match = key.match(/(\d+)\.(gif|png|jpg|jpeg)$/i);
			if (match) {
				const id = match[1];
				emotionImages[id] = emotionContext(key);
			}
		});
		// eslint-disable-next-line no-console
		console.log(`成功加载 ${Object.keys(emotionImages).length} 个表情图片`);
	} catch (error) {
		// eslint-disable-next-line no-console
		console.warn('表情图片加载失败，请检查图片路径:', error);
	}
}

// 初始化
loadEmotionData();
loadEmotionImages();

// 获取图片URL
export function getImgUrl(id) {
	const image = emotionImages[id];
	if (image) {
		return image;
	}
	return `/emotionImgs/${id}.gif`;
}

// 将表情文本转换为HTML图片标签
export function emotion(res) {
	const word = res.replace(/\[|\]/gi, '');
	let id = emotionMap[word];

	// 如果直接找不到，尝试在所有分类中查找
	if (id === undefined || id === null) {
		for (const category of emotionCategories) {
			const found = category.emotions.find(item => item.text === word);
			if (found) {
				id = found.id;
				break;
			}
		}
	}

	if (id !== undefined && id !== null) {
		const url = getImgUrl(id);
		if (url) {
			return `<img class="emoji-img" width="24" height="24" src="${url}" alt="${word}" title="${word}" />`;
		}
	}
	return res;
}

// 替换文本中的表情
export function replaceEmotionText(content) {
	if (!content || typeof content !== 'string') return '';
	// 支持中文、英文、数字的表情名称
	return content.replace(/\[[\u4E00-\u9FA5a-zA-Z0-9]{1,20}\]/gi, emotion);
}

// 解析混合内容（文本+表情）
export function parseMixedContent(content) {
	if (!content || typeof content !== 'string') return '';

	// 更灵活的正则匹配，支持中英文数字混合的表情名称
	const regex = /(\[[\u4E00-\u9FA5a-zA-Z0-9]{1,20}\])/g;
	const parts = content.split(regex);

	return parts
		.map(part => {
			if (part.startsWith('[') && part.endsWith(']')) {
				const emotionResult = emotion(part);
				return emotionResult !== part ? emotionResult : part;
			}
			return part;
		})
		.join('');
}

// 根据ID获取表情文本
export function getEmotionTextById(id) {
	for (const category of emotionCategories) {
		const emotion = category.emotions.find(item => item.id === id);
		if (emotion) {
			return emotion.text;
		}
	}
	return '';
}

// 根据文本获取表情ID
export function getEmotionIdByText(text) {
	return emotionMap[text] !== undefined ? emotionMap[text] : -1;
}

// 获取所有表情分类
export function getAllCategories() {
	return emotionCategories.map(cat => ({
		category: cat.category,
		emotions: cat.emotions.map(item => ({
			...item,
			url: getImgUrl(item.id)
		}))
	}));
}

// 获取所有表情（扁平化）
export function getAllEmotions() {
	const allEmotions = [];
	emotionCategories.forEach(cat => {
		cat.emotions.forEach(item => {
			allEmotions.push({
				...item,
				category: cat.category,
				url: getImgUrl(item.id)
			});
		});
	});
	return allEmotions;
}

// 检查表情图片是否可用
export function checkEmotionAvailable(id) {
	return !!emotionImages[id];
}

// 导出兼容旧版的emotionData（已废弃，建议使用getAllEmotions）
export const emotionData = getAllEmotions();

export default {
	emotionData,
	emotionMap,
	getImgUrl,
	emotion,
	replaceEmotionText,
	parseMixedContent,
	getEmotionTextById,
	getEmotionIdByText,
	getAllEmotions,
	getAllCategories,
	checkEmotionAvailable
};
