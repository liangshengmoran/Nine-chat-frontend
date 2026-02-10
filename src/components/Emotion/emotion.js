// 动态加载所有表情分类数据
const emotionCategories = [];
const emotionMap = {}; // key: "分类:文本" 或 "文本" → value: { id, imgDir }
const emotionImages = {}; // key: imgDir → value: { id: imageModule }

// 自动加载所有JSON文件
function loadEmotionData() {
	try {
		const dataContext = require.context('@/components/Emotion/emotionData', false, /\.json$/);

		dataContext.keys().forEach(key => {
			const categoryData = dataContext(key);
			const imgDir = categoryData.imgDir || categoryData.category;

			emotionCategories.push({
				category: categoryData.category,
				imgDir: imgDir,
				emotions: categoryData.emotions
			});

			// 构建表情映射表，key格式: "分类:文本" 和 "文本"（兼容旧格式）
			categoryData.emotions.forEach(item => {
				const fullKey = `${categoryData.category}:${item.text}`;
				emotionMap[fullKey] = { id: item.id, imgDir };

				// 为了兼容性，也保留纯文本映射（可能会被覆盖，以最后加载的为准）
				if (!emotionMap[item.text]) {
					emotionMap[item.text] = { id: item.id, imgDir };
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

// 加载表情图片（从分类子目录加载，按目录名隔离）
function loadEmotionImages() {
	try {
		const emotionContext = require.context('@/components/Emotion/emotionImgs', true, /\.(gif|png|jpg|jpeg)$/i);
		emotionContext.keys().forEach(key => {
			// key 格式: ./默认/0.gif 或 ./Sticker/105.png
			const parts = key.split('/');
			// 跳过根目录下的文件，只读取子目录中的文件
			if (parts.length < 3) return;

			const dirName = parts[1]; // 子目录名，如 "默认"、"Sticker"
			const filename = parts[parts.length - 1];
			const match = filename.match(/(\d+)\.(gif|png|jpg|jpeg)$/i);
			if (match) {
				const id = match[1];
				if (!emotionImages[dirName]) emotionImages[dirName] = {};
				emotionImages[dirName][id] = emotionContext(key);
			}
		});

		const totalCount = Object.values(emotionImages).reduce((sum, dir) => sum + Object.keys(dir).length, 0);
		// eslint-disable-next-line no-console
		console.log(`成功加载 ${totalCount} 个表情图片（${Object.keys(emotionImages).join(', ')}）`);
	} catch (error) {
		// eslint-disable-next-line no-console
		console.warn('表情图片加载失败，请检查图片路径:', error);
	}
}

// 初始化
loadEmotionData();
loadEmotionImages();

// 获取图片URL（需要指定 imgDir 来区分不同分类）
export function getImgUrl(id, imgDir) {
	if (imgDir && emotionImages[imgDir] && emotionImages[imgDir][id]) {
		return emotionImages[imgDir][id];
	}
	// 回退：遍历所有目录查找
	for (const dir of Object.keys(emotionImages)) {
		if (emotionImages[dir][id]) {
			return emotionImages[dir][id];
		}
	}
	return null;
}

// 将表情文本转换为HTML图片标签
export function emotion(res) {
	const word = res.replace(/\[|\]/gi, '');
	let mapping = emotionMap[word];

	// 如果直接找不到，尝试在所有分类中查找
	if (!mapping) {
		for (const category of emotionCategories) {
			const found = category.emotions.find(item => item.text === word);
			if (found) {
				mapping = { id: found.id, imgDir: category.imgDir };
				break;
			}
		}
	}

	if (mapping) {
		const url = getImgUrl(mapping.id, mapping.imgDir);
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

// 根据ID和分类获取表情文本
export function getEmotionTextById(id, targetCategory) {
	if (targetCategory) {
		const cat = emotionCategories.find(c => c.category === targetCategory);
		if (cat) {
			const found = cat.emotions.find(item => item.id === id);
			if (found) return found.text;
		}
	}
	for (const category of emotionCategories) {
		const found = category.emotions.find(item => item.id === id);
		if (found) return found.text;
	}
	return '';
}

// 根据文本获取表情ID
export function getEmotionIdByText(text) {
	const mapping = emotionMap[text];
	return mapping ? mapping.id : -1;
}

// 获取所有表情分类（带图片URL）
export function getAllCategories() {
	return emotionCategories.map(cat => ({
		category: cat.category,
		imgDir: cat.imgDir,
		emotions: cat.emotions.map(item => ({
			...item,
			imgDir: cat.imgDir,
			url: getImgUrl(item.id, cat.imgDir)
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
				imgDir: cat.imgDir,
				url: getImgUrl(item.id, cat.imgDir)
			});
		});
	});
	return allEmotions;
}

// 检查表情图片是否可用
export function checkEmotionAvailable(id, imgDir) {
	if (imgDir) {
		return !!(emotionImages[imgDir] && emotionImages[imgDir][id]);
	}
	return Object.values(emotionImages).some(dir => !!dir[id]);
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
