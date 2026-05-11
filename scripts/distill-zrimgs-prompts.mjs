import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const defaultInputRoot = path.resolve(repoRoot, '.ccks-local', 'zrimgs-prompts')

const options = parseArgs(process.argv.slice(2))
const inputRoot = path.resolve(options.input || defaultInputRoot)
const recipePath = options.recipe ? path.resolve(options.recipe) : ''

const normalizedPath = path.join(inputRoot, 'normalized-prompts.jsonl')
const draftPath = path.join(inputRoot, 'zrimgs-recipe-draft.json')
const reviewPath = path.join(inputRoot, 'zrimgs-recipe-review.md')
const zlexPath = path.join(inputRoot, 'zrimgs-recipe.zlex')
const templateDraftPath = path.join(inputRoot, 'zrimgs-template-draft.json')
const templateReviewPath = path.join(inputRoot, 'zrimgs-template-review.md')

const TEMPLATE_FAMILY_DEFINITIONS = [
  {
    id: 'image-chibi-transparent',
    name: 'Q 版透明背景角色/表情包',
    category: 'ZrImgs 蒸馏模板',
    description: '适合头像、贴纸、表情包、吉祥物和轻量应用插图，强调 Q 版、动作夸张、透明背景和边缘干净。',
    primarySignals: ['透明背景', 'transparent background'],
    secondarySignals: ['Q版', 'chibi', '可爱', '贴纸', '表情包', '动漫', '吉祥物', '程序员'],
    minScore: 2,
    inputFields: ['角色主体', '动作/情绪', '短文字气泡', '道具', '用途', '透明背景要求'],
    promptSkeleton:
      '绘制一个 Q 版可爱角色贴纸，透明背景。角色主体：[角色主体]。动作和情绪：[动作/情绪]。主体居中完整不裁切，轮廓清晰，边缘干净，可加入少量道具和情绪符号，适合头像、表情包或贴纸复用。',
    negativePromptFocus: ['复杂背景', '主体被裁切', '边缘脏', '文字乱码', '过度写实', '低清晰度'],
  },
  {
    id: 'image-ecommerce-russian',
    name: '白底俄语电商图',
    category: 'ZrImgs 蒸馏模板',
    description: '适合跨境电商商品主图、俄语卖点标签、产品参数图和详情页素材。',
    primarySignals: ['俄语', '俄文', 'russian', '电商', '商品图', '产品名称'],
    secondarySignals: ['商品', '产品', '白底', '主图', '参数', '特性', '商标', '标签', '卖点', '产品描述', '详情'],
    minScore: 3,
    inputFields: ['产品名称', '产品参数', '俄语标签', '品牌/商标锁定', '商品角度', '背景', '比例'],
    promptSkeleton:
      '生成一张白底俄语电商商品图。产品：[产品名称]。商品主体清晰完整，白底干净，阴影自然。左侧或右侧排版俄语短标签和参数模块，突出 [产品参数/卖点]，品牌或商标位置保持稳定，整体像成熟跨境电商主图。',
    negativePromptFocus: ['非白底', '俄语错别字', '乱码文字', '品牌变形', '产品角度错误', '参数过密'],
  },
  {
    id: 'image-product-parameter-card',
    name: '产品参数卖点图',
    category: 'ZrImgs 蒸馏模板',
    description: '适合详情页参数图、功能说明图、卖点卡片和多图系列中的第二/第三张。',
    primarySignals: ['参数', '特性', '功能', '卖点', '详情图'],
    secondarySignals: ['产品', '商品', '标签', '工作时间', '亮度', '防水', '尺寸', '材质', '左侧部分', '宣传参数'],
    minScore: 2,
    inputFields: ['产品主体', '核心卖点', '参数清单', '产品摆放位置', '信息层级', '品牌要求', '背景风格'],
    promptSkeleton:
      '生成一张产品参数卖点说明图。产品放在 [位置]，周围用清晰标签说明 [参数清单]。版式像成熟电商详情页，主标题醒目，参数短标签清楚，辅助说明不拥挤，颜色与产品风格一致。',
    negativePromptFocus: ['参数错误', '小字过密', '排版混乱', '产品变形', '信息遮挡主体', '低端模板感'],
  },
  {
    id: 'image-reference-edit',
    name: '图生图局部修改/保留主体',
    category: '图生图修改',
    description: '适合去除物体、局部修正、换装、换包装、保持主体身份和原图结构的编辑任务。',
    primarySignals: ['原图', '参考图', '保持不动', '全部不动', '局部', '被涂', '去掉', '换', '穿到'],
    secondarySignals: ['商标', '排版', '套装', '模特', '枪头', '修正', '保留', '不要变动', '效果图'],
    minScore: 1,
    inputFields: ['参考图说明', '必须保留', '需要修改', '编辑区域', '身份锁定', '光影/材质匹配', '禁止改变'],
    promptSkeleton:
      '基于参考图进行局部修改，只改 [需要修改]，其他部分保持不变。必须保留 [主体身份/构图/背景/品牌/光影]。修改要自然融入原图，透视、材质、阴影、边缘和清晰度匹配原始画面。',
    negativePromptFocus: ['改变主体身份', '背景重绘', '姿势改变', '品牌错位', '边缘破损', '颜色不一致'],
  },
  {
    id: 'image-game-screenshot',
    name: '游戏实机宣传截图',
    category: 'ZrImgs 蒸馏模板',
    description: '适合次世代游戏实机风、官方宣传截图、开放世界场景和角色/车辆展示。',
    primarySignals: ['游戏', '实机', '截图', 'game', 'screenshot', '黑神话', '三角洲行动', 'forza'],
    secondarySignals: ['开放世界', '宣传', 'logo', '8K', '电影级光影', '角色画风', '战术装备', '速度感'],
    minScore: 1,
    inputFields: ['游戏名', '世界观/地点', '主体', '动态瞬间', 'logo/宣传文案', '画幅', '材质和光影'],
    promptSkeleton:
      '创作一张像官方发布的游戏实机宣传截图，而不是普通海报。游戏名：[游戏名]，场景：[地点/世界观]，主体：[角色/车辆/事件]。画面体现真实可玩空间、动态瞬间、电影级光影、真实材质和空气透视，保留 logo 或宣传文案区域。',
    negativePromptFocus: ['普通海报感', 'UI 杂乱', 'logo 乱码', '场景空洞', '低端手游质感', '透视错误'],
  },
  {
    id: 'image-comic-story-page',
    name: '漫画分镜/故事单页',
    category: 'ZrImgs 蒸馏模板',
    description: '适合故事书插画、漫画单页、多格分镜和成熟动漫叙事页。',
    primarySignals: ['分镜', '漫画', '第1页', '第2页', '第3页', 'panel', 'storybook', 'graphic novel'],
    secondarySignals: ['故事', '场景', 'main panel', 'inset panels', 'grid style', '固定前缀', 'mature anime', 'cinematic lighting', 'delicate linework'],
    minScore: 2,
    inputFields: ['页码/场景', '故事内容', '角色锁定', '页面结构', '每格节拍', '统一风格前缀', '一致性要求'],
    promptSkeleton:
      '生成一页完整漫画/故事书分镜图。页码/场景：[页码与场景]。页面结构：[single full-page panel / main panel + inset panels / grid style]。每格包含清晰动作、视线方向、前中后景和叙事功能，角色、服装、时间、空间和光线保持一致。',
    negativePromptFocus: ['分格混乱', '角色不一致', '服装漂移', '文字乱码', '故事顺序错误', '低质草图'],
  },
  {
    id: 'image-logo-typography',
    name: '字体 Logo 概念主视觉',
    category: 'ZrImgs 蒸馏模板',
    description: '适合品牌字标、文字主视觉、字体美学概念图和 logo 探索。',
    primarySignals: ['logo', '字体', '字词', 'typography', '目标字词'],
    secondarySignals: ['文字', '品牌', 'openai', '主视觉', '醒目', '可读', '美学', '概念图像', '品牌视觉'],
    minScore: 2,
    inputFields: ['目标字词', '品牌含义', '情绪/象征', '字体风格', '材质', '背景元素', '用途'],
    promptSkeleton:
      '以「[目标字词]」为核心生成字体美学概念图像。目标字词必须成为最大、最醒目、最可读的视觉主体，其他元素只服务文字含义、情绪和品牌气质。字体结构稳定，有高级设计感。',
    negativePromptFocus: ['目标字词不可读', '错别字', '文字变形', '背景抢主体', '小字过多', '低端模板'],
  },
  {
    id: 'image-world-map-lore',
    name: '世界地图设定图',
    category: 'ZrImgs 蒸馏模板',
    description: '适合奇幻/科幻世界地图、势力分布、地理设定和桌游/小说设定图。',
    primarySignals: ['地图', '世界地图', '地理', '国家', '势力', 'map', 'world'],
    secondarySignals: ['大陆', '海洋', '山脉', '城市', '边界', '罗盘', '图例', '魔法', '行星'],
    minScore: 1,
    inputFields: ['世界名称', '世界观', '地理元素', '势力/国家', '重要城市', '图例/罗盘', '标注要求'],
    promptSkeleton:
      '生成一张完整世界地图设定图。包含主要大陆、海洋、山脉、河流、城市、国家/势力边界、重要遗迹或资源点。地图整体完整，边框、比例尺、罗盘和图例清楚，重点地名优先。',
    negativePromptFocus: ['地图断裂', '边界混乱', '文字乱码', '地理关系不合理', '区域拥挤', '没有图例'],
  },
  {
    id: 'image-video-keyframe-sheet',
    name: '视频关键帧/联络单',
    category: 'ZrImgs 蒸馏模板',
    description: '适合把参考图或故事转成 3x3/4x3 关键帧联络单，用于 AI 视频生成前置设计。',
    primarySignals: ['关键帧', 'keyframe', '视频', '短片', '联络单', 'contact sheet', 'kf#', '分镜剧情'],
    secondarySignals: ['镜头类型', '建议时长', '相机运动', '情感弧线', 'visual anchors', 'scene breakdown', '预告片导演'],
    minScore: 1,
    inputFields: ['故事/需求', '主体锁定', '环境与视觉锚点', '关键帧数量', '情绪弧线', '镜头类型', '联络单布局'],
    promptSkeleton:
      '生成一张 AI 视频关键帧联络单。默认 3x3 或 4x3，每格代表一个关键帧，并标注 KF 编号、镜头类型和建议时长。所有关键帧保持同一主体、服装、环境、光影和调色，镜头逻辑连贯。',
    negativePromptFocus: ['关键帧不连贯', '角色漂移', '环境变化', 'KF 标注乱码', '分格混乱', '轴线错误'],
  },
  {
    id: 'image-fashion-commercial',
    name: '时尚/服装商业广告',
    category: 'ZrImgs 蒸馏模板',
    description: '适合服装、内衣、模特穿搭、电商宣传和艺术化商业广告。',
    primarySignals: ['模特', '穿着', '电商宣传图', '商业广告', 'fashion', 'calvin', '内衣'],
    secondarySignals: ['服装', '人物占', '产品', '艺术画作', '高级', '摄影棚', '薄纱', '联动款', '穿搭'],
    minScore: 1,
    inputFields: ['品牌/产品', '模特设定', '服装细节', '商业主题', '主体占比', '拍摄场景', '广告气质'],
    promptSkeleton:
      '生成一张时尚商业广告图。模特穿着 [服装/产品]，主体占画面 [比例]，服装结构和材质清晰，画面贴合 [商业主题]。整体兼具电商转化和艺术画报质感，像可发布的品牌广告。',
    negativePromptFocus: ['服装结构错误', '低俗表达', '品牌错位', '身体比例错误', '脸部崩坏', '广告廉价感'],
  },
  {
    id: 'image-no-human-scene',
    name: '无人纯场景设定图',
    category: 'ZrImgs 蒸馏模板',
    description: '适合空间、场景、地点、行业作业点和无人环境概念图。',
    primarySignals: ['无人', 'no humans', 'empty', 'landscape only', '纯场景', '场景设定图'],
    secondarySignals: ['画幅构图', '电影级场景', '写实电影', '空间', '环境', '水泥地面', '晴日', '明亮日光'],
    minScore: 1,
    inputFields: ['场景地点', '时间天气', '关键物件', '行业/用途', '画幅', '光线', '禁止人物'],
    promptSkeleton:
      '生成一张横向电影级无人场景设定图。地点：[场景地点]，时间天气：[时间天气]，关键物件：[关键物件]。画面必须是纯场景，no humans, empty, landscape only，空间层次和行业细节清楚。',
    negativePromptFocus: ['人物误入', '主体不明', '空间关系混乱', '透视错误', '杂乱堆砌', '低清晰度'],
  },
  {
    id: 'image-group-portrait-era',
    name: '年代群像/多人合影',
    category: '人物与叙事',
    description: '适合多人站位、亲密互动、年代地点和真实街景人物合影。',
    primarySignals: ['三位', '多人', '并排站立', '合影', '全身人像', '群像'],
    secondarySignals: ['90年代', '深圳', '工业区', '亲密互动', '微笑', '东方女性', '街道', '厂房', '人物占据'],
    minScore: 2,
    inputFields: ['人物数量', '人物关系', '站位姿态', '年代地点', '背景建筑', '情绪氛围', '服装身份'],
    promptSkeleton:
      '生成一张真实年代感多人合影。人物数量：[人物数量]，关系：[人物关系]，站位与动作：[站位姿态]。背景为 [年代地点/建筑]，构图稳定，人物表情自然，服装、发型和环境细节符合时代背景。',
    negativePromptFocus: ['人物数量错误', '脸部崩坏', '手部错误', '年代错位', '背景穿帮', '关系不清'],
  },
  {
    id: 'image-character-anime-game',
    name: '动漫/游戏角色主视觉',
    category: '人物与叙事',
    description: '适合游戏人物、二次元角色、民族风少女、黑神话风角色和角色宣传图。',
    primarySignals: ['角色', '少女', '动漫', '二次元', '游戏人物', '黑神话'],
    secondarySignals: ['耳饰', '民族风', '主角', '美女', '宣传图片', '人物形象一致', '超清', '场景真实', '性感', '妩媚'],
    minScore: 2,
    inputFields: ['角色身份', '外观特征', '服装道具', '画风参考', '场景主题', '姿态表情', '画幅'],
    promptSkeleton:
      '生成一张角色主视觉。角色：[角色身份]，外观特征：[外观特征]，服装和道具：[服装道具]。画风参考 [画风参考]，场景贴合 [场景主题]，人物辨识度高，适合宣传海报或角色展示。',
    negativePromptFocus: ['身份漂移', '服装错误', '比例错误', '脸部崩坏', '手部错误', '低清晰度'],
  },
  {
    id: 'image-reference-character-cosplay',
    name: '参考图角色一致性 Cosplay',
    category: '图生图修改',
    description: '适合根据参考图锁定发型、配饰、服装和身份的写实随拍或 Cosplay 图。',
    primarySignals: ['reference image', 'identity match', 'cosplayer', 'same hairstyle', '参考图'],
    secondarySignals: ['exactly', 'same hair', 'same accessories', 'iphone snapshot', 'recreating', 'twin tails', 'hair color'],
    minScore: 2,
    inputFields: ['参考图', '身份锁定点', '发型配饰', '服装结构', '拍摄设备', '姿态场景', '不可改变项'],
    promptSkeleton:
      '基于参考图生成角色一致性照片。严格保持 [身份锁定点]，包括发型、发色、配饰、服装结构和角色气质。画面像 [拍摄设备/拍摄场景] 的自然照片，但不能改变参考角色的核心识别特征。',
    negativePromptFocus: ['身份不一致', '发型错误', '配饰缺失', '服装漂移', '过度美化', '不像随拍'],
  },
  {
    id: 'image-product-angle-replace',
    name: '产品角度替换/包装保持',
    category: '产品与电商',
    description: '适合更换产品角度、保持 logo/包装模板、尺寸标注和局部产品替换。',
    primarySignals: ['换产品角度', '角度', '模板不动', 'logo模板不动', '商标不要变动', '产品高'],
    secondarySignals: ['整体文字', '尺寸', 'CM', '产品描述', '包装', '商品', '主图', '重点突出特点'],
    minScore: 1,
    inputFields: ['产品资料', '目标角度', '必须保持区域', '尺寸参数', '包装文字', '商标位置', '禁止变化'],
    promptSkeleton:
      '对产品图做角度或包装替换。产品资料：[产品资料]，目标角度：[目标角度]。必须保持 [模板/logo/文字区域] 不变，尺寸参数 [尺寸参数] 清晰可信，产品透视和材质自然。',
    negativePromptFocus: ['模板改变', 'logo 变形', '尺寸错误', '产品透视错误', '文字乱码', '包装错位'],
  },
  {
    id: 'image-outdoor-camping-product',
    name: '户外露营产品场景图',
    category: '产品与电商',
    description: '适合露营灯、户外装备、使用场景和功能标签结合的商品图。',
    primarySignals: ['露营灯', '露营', '户外', '防水', '亮度', '工作时间'],
    secondarySignals: ['手机供电', '50M', '6小时', '元素', '标签', '商品图', '电商', '场景'],
    minScore: 1,
    inputFields: ['产品名称', '使用场景', '功能参数', '标签文案', '光线氛围', '主体位置', '比例'],
    promptSkeleton:
      '生成一张户外装备商品图。产品：[产品名称]，使用场景：[使用场景]，突出功能参数 [功能参数]。画面包含露营元素和清晰标签，产品主体完整，光线与户外氛围匹配。',
    negativePromptFocus: ['场景不相关', '参数错误', '标签乱码', '主体过小', '低质抠图', '材质不真实'],
  },
  {
    id: 'image-marker-style-conversion',
    name: '马克笔/手绘风格转换',
    category: '风格转换',
    description: '适合把现有画面或需求改成马克笔、手绘草图、设计表现图风格。',
    primarySignals: ['马克笔', '手绘', '画风', 'marker', 'sketch'],
    secondarySignals: ['稍微', '风格', '帮我做', '设计稿', '草图', '线稿', '水彩', '插画'],
    minScore: 1,
    inputFields: ['原始画面', '目标风格', '保留内容', '线条粗细', '上色方式', '纸张质感', '完成度'],
    promptSkeleton:
      '将画面转换为 [目标风格]。保留 [原始画面/主体] 的构图和识别特征，使用清晰手绘线条、马克笔色块和适度纸张纹理，整体像专业设计表现图。',
    negativePromptFocus: ['主体改变', '线条杂乱', '颜色脏', '低完成度', '过度写实', '丢失原构图'],
  },
  {
    id: 'image-poster-from-reference-kids',
    name: '参考人物海报再设计',
    category: '图生图修改',
    description: '适合基于原图人物生成海报、主题自拟但保留人物身份的再设计。',
    primarySignals: ['原图中', '生成一张海报', '主体自拟', '风格自拟'],
    secondarySignals: ['小朋友', '人物', '海报图', '参考图', '保持', '主题', '风格'],
    minScore: 1,
    inputFields: ['参考图', '人物锁定', '海报主题', '视觉风格', '标题区', '背景元素', '禁止改变'],
    promptSkeleton:
      '基于参考图人物生成一张主题海报。保留 [人物锁定]，主题为 [海报主题]，视觉风格 [视觉风格]。人物与背景自然融合，标题区清晰，整体像可发布海报。',
    negativePromptFocus: ['人物身份改变', '脸部不一致', '海报廉价', '文字乱码', '主体被遮挡', '构图混乱'],
  },
  {
    id: 'image-industrial-product-cleanup',
    name: '工业产品局部校正/去除遮挡',
    category: '图生图修改',
    description: '适合枪头、夹子、零件、工业产品局部歪斜修正和去除遮挡物。',
    primarySignals: ['枪头', '夹子', '歪了', '直起来', '去掉商品上'],
    secondarySignals: ['局部', '被涂', '修正', '整体全部不动', '产品', '不动', '去除'],
    minScore: 1,
    inputFields: ['参考图', '修正部位', '目标状态', '必须不动区域', '材质匹配', '边缘处理', '禁止重绘'],
    promptSkeleton:
      '对工业/商品图进行局部校正。只修改 [修正部位] 为 [目标状态]，其他区域全部保持不动。修正后的结构、材质、阴影、边缘和清晰度必须匹配原图。',
    negativePromptFocus: ['整体重绘', '产品变形', '边缘破损', '材质不一致', '背景改变', '品牌错位'],
  },
  {
    id: 'image-commercial-main-visual',
    name: '商业主视觉/活动海报',
    category: '营销视觉',
    description: '适合活动主题、品牌主视觉、宣传图和核心信息视觉化。',
    primarySignals: ['海报', '宣传图', '主视觉', '活动', '品牌视觉'],
    secondarySignals: ['标题', '文案', '高级', '商业', '核心信息', '促销', '发布', '主题'],
    minScore: 2,
    inputFields: ['活动主题', '核心信息', '品牌调性', '视觉元素', '版式层级', '用途比例', '禁用内容'],
    promptSkeleton:
      '生成一张商业主视觉海报。主题：[活动主题]，核心信息：[核心信息]。主视觉突出、标题区清晰、辅助元素围绕主题展开，整体符合 [品牌调性]，适合 [用途比例] 发布。',
    negativePromptFocus: ['文字乱码', '信息拥挤', '主体不明', '低端模板', '品牌调性不符', '排版混乱'],
  },
  {
    id: 'image-social-cover',
    name: '社媒封面/首图',
    category: '营销视觉',
    description: '适合小红书、公众号、短视频封面和移动端首图。',
    primarySignals: ['封面', '首图', '小红书', '公众号', '社媒'],
    secondarySignals: ['标题', '移动端', '一眼可读', '配图', '封面图', '比例', '醒目'],
    minScore: 1,
    inputFields: ['封面主题', '标题文案', '目标读者', '视觉关键词', '平台比例', '主体元素', '留白区'],
    promptSkeleton:
      '生成一张移动端社媒封面。主题：[封面主题]，标题：[标题文案]。主体突出，标题区留白明确，背景不抢信息，小尺寸下仍一眼可读。',
    negativePromptFocus: ['标题不可读', '小字太多', '主体过小', '低对比', '裁切关键信息', '信息拥挤'],
  },
  {
    id: 'image-product-white-background',
    name: '白底产品主图',
    category: '产品与电商',
    description: '适合电商白底主图、产品清晰展示、干净阴影和主体占比控制。',
    primarySignals: ['白底', '主图', '商品主体', '产品主体', '商品图'],
    secondarySignals: ['阴影自然', '主体占', '干净', '完整', '清晰', '边缘', '角度', '电商'],
    minScore: 2,
    inputFields: ['产品名称', '产品资料', '主体占比', '展示角度', '材质', '阴影', '比例'],
    promptSkeleton:
      '生成一张白底产品主图。产品：[产品名称]，主体占画面 [主体占比]，边缘清晰完整，角度展示关键结构，白底干净，阴影自然，材质真实。',
    negativePromptFocus: ['非白底', '主体过小', '产品变形', '阴影脏', '低质抠图', '背景杂乱'],
  },
  {
    id: 'image-product-infographic',
    name: '产品信息图/功能说明',
    category: '产品与电商',
    description: '适合参数、功能、尺寸、材质和使用场景的信息模块说明图。',
    primarySignals: ['功能', '参数', '尺寸', '信息模块', '说明图'],
    secondarySignals: ['产品', '标签', '卖点', '材质', '使用场景', '详情页', '优势', '短标签'],
    minScore: 2,
    inputFields: ['产品名称', '功能卖点', '参数清单', '信息模块', '版式结构', '文字层级', '背景场景'],
    promptSkeleton:
      '生成一张产品信息图。产品主体与信息模块分区清晰，用短标签说明 [功能卖点/参数清单]，排版像成熟详情页，文字少而可读，不遮挡产品。',
    negativePromptFocus: ['参数错误', '小字过密', '文字乱码', '信息遮挡', '排版混乱', '产品变形'],
  },
  {
    id: 'image-cinematic-environment',
    name: '电影级环境概念图',
    category: '场景与世界观',
    description: '适合城市、自然、室内外空间、世界观场景和环境叙事图。',
    primarySignals: ['电影级', '场景', '环境', '城市', '空间', '概念图'],
    secondarySignals: ['光影', '空气透视', '前景', '中景', '远景', '写实', '氛围', '世界观'],
    minScore: 2,
    inputFields: ['场景地点', '世界观背景', '关键物件', '时间天气', '镜头景别', '光影色调', '叙事线索'],
    promptSkeleton:
      '生成一张电影级环境概念图。地点：[场景地点]，世界观：[世界观背景]，关键物件：[关键物件]。前中远景层次清楚，光影和空气透视服务环境叙事。',
    negativePromptFocus: ['空间混乱', '透视错误', '主体不明', '细节堆砌', '低清晰度', '氛围不统一'],
  },
  {
    id: 'image-vehicle-racing',
    name: '赛车/车辆速度场景',
    category: '游戏与载具',
    description: '适合赛车游戏截图、车辆广告、速度感道路和城市天际线。',
    primarySignals: ['赛车', '车辆', 'forza', '地平线', '速度感', '道路'],
    secondarySignals: ['反射', '路面细节', '城市天际线', '开放世界', '实机截图', '灯光氛围', '空气透视'],
    minScore: 1,
    inputFields: ['车辆主体', '城市地点', '时间天气', '道路环境', '速度动作', '宣传文案', '材质反射'],
    promptSkeleton:
      '生成一张车辆速度场景图。车辆：[车辆主体]，地点：[城市地点]，道路环境：[道路环境]。画面有强速度感、真实车漆反射、路面细节和城市光影，像官方赛车游戏/汽车广告截图。',
    negativePromptFocus: ['车辆变形', '速度感不足', '路面虚假', '反射错误', '透视错误', '普通海报感'],
  },
  {
    id: 'image-storybook-anime-page',
    name: '成熟动漫故事书插画',
    category: '漫画与故事',
    description: '适合成熟动漫、故事书、文学绘本和单页叙事插画。',
    primarySignals: ['storybook', 'mature anime', 'literary graphic novel', '故事书', '插画'],
    secondarySignals: ['delicate linework', 'cinematic atmosphere', 'scene', '第', '页', '主格', '统一风格前缀'],
    minScore: 2,
    inputFields: ['页码场景', '故事节拍', '角色状态', '环境光影', '统一风格', '画面结构', '叙事情绪'],
    promptSkeleton:
      '生成一张成熟动漫故事书插画。页码/场景：[页码场景]，故事节拍：[故事节拍]。保持文学绘本质感、电影氛围、精致线条和统一色彩，画面有明确叙事动作。',
    negativePromptFocus: ['故事不清', '角色漂移', '低质草图', '表情僵硬', '线条混乱', '画风不统一'],
  },
  {
    id: 'image-text-logo-lockup',
    name: '文字模板/Logo 锁定编辑',
    category: '品牌与字体',
    description: '适合文字 logo 模板不动、字词主视觉、品牌字形和排版锁定。',
    primarySignals: ['文字logo', 'logo模板不动', '字词', '字体', '文字必须'],
    secondarySignals: ['模板不动', '品牌', '可读', '目标字词', '排版', '醒目', '字形'],
    minScore: 1,
    inputFields: ['目标字词', '模板锁定项', '品牌含义', '字体风格', '材质色彩', '背景元素', '可读性要求'],
    promptSkeleton:
      '生成或编辑文字 Logo 主视觉。目标字词：[目标字词] 必须清晰可读，模板锁定项 [模板锁定项] 不变。字体结构稳定，材质和背景服务品牌含义，不抢文字主体。',
    negativePromptFocus: ['文字不可读', '模板改变', '错别字', '字形变形', '背景抢主体', '小字过多'],
  },
  {
    id: 'image-fantasy-wuxia-promo',
    name: '东方玄幻/黑神话风宣传图',
    category: '人物与叙事',
    description: '适合黑神话、东方玄幻、游戏角色阵容和宽屏宣传图。',
    primarySignals: ['黑神话', '斗破苍穹', '玄幻', '东方', '21:9'],
    secondarySignals: ['主角', '宣传图片', '场景真实', '超清', '游戏主题', '人物一致', '宽屏'],
    minScore: 1,
    inputFields: ['作品/世界观', '角色阵容', '角色一致性', '场景主题', '画幅比例', '质感要求', '禁用内容'],
    promptSkeleton:
      '生成一张东方玄幻游戏宣传图。作品/世界观：[作品/世界观]，角色阵容：[角色阵容]，角色形象保持一致。画幅 [画幅比例]，场景真实贴合主题，质感超清，适合官方宣传。',
    negativePromptFocus: ['角色不像原设', '阵容数量错误', '低俗过度', '场景不符', '脸部崩坏', '低清晰度'],
  },
  {
    id: 'image-ink-myth-bridge-poster',
    name: '水墨神话孤行海报',
    category: '收藏叙事海报',
    description: '适合神话人物、孤独前行、巨大精神象征、古桥和极简水墨海报。',
    primarySignals: ['孙悟空', '金箍棒', '佛面', '水墨'],
    secondarySignals: ['stone bridge', 'ancient stone bridge', 'golden staff', 'sparks', 'ink wash', 'white void', '朱红', '作者名', '晚睡自愈丸'],
    minScore: 3,
    inputFields: ['神话角色', '标志道具', '古桥/行走姿态', '背景精神象征', '点睛色', '作者署名', '画面尺寸'],
    promptSkeleton:
      '生成一张极简中国神话水墨海报。主体 [神话角色] 沿狭窄古桥孤独前行，拖拽 [标志道具] 留下金色火花。背景为巨大褪色的 [精神象征]，白色虚空、大面积留白，黑白水墨为主，只用金色和朱红点睛，底部保留低调作者署名。',
    negativePromptFocus: ['多余文字', '彩色过多', '廉价武侠游戏感', '背景拥挤', '角色比例错误', '3D 塑料感'],
  },
  {
    id: 'image-city-summer-ribbon-poster',
    name: '夏日城市绸带双曝海报',
    category: '城市与国潮海报',
    description: '适合城市文旅、夏日宣传、S 型丝绸变河流、国潮手绘地标和大面积留白海报。',
    primarySignals: ['SUMMER 2026', '武汉', '翠绿色丝绸', '黄鹤楼'],
    secondarySignals: ['S型', '双重曝光', '城市宣传海报', '长江大桥', '江汉关', '东湖荷花', '江城夏日', '国潮', '9:16'],
    minScore: 3,
    inputFields: ['城市名称', '年份', '微缩人物动作', '绸带/河流动线', '城市地标', '主标题', '宣传语', '画幅比例'],
    promptSkeleton:
      '生成一张城市夏日宣传海报。右下角微缩人物挥舞翠绿色丝绸，丝绸沿 S 型动线变成清澈河流，河流内部叠加 [城市] 国潮手绘地标。白色纹理背景、大面积留白，左下角排版 [主标题] 和竖排宣传语。',
    negativePromptFocus: ['城市地标错误', '文字乱码', '留白不足', '色彩浑浊', '地标堆砌', '绸带不像河流'],
  },
  {
    id: 'image-guochao-character-double-exposure',
    name: '国风角色双曝主视觉',
    category: '收藏叙事海报',
    description: '适合 IP 角色、巨型头部剪影、下方完整人物、国风战袍和内部世界叙事拼贴。',
    primarySignals: ['上大下小', '双重曝光', '草帽', '路飞'],
    secondarySignals: ['国风游戏人物宣传海报', '头部', '完整人物', '剪影式主形', '内部拼贴', '水墨', '留白', '系列化海报'],
    minScore: 3,
    inputFields: ['角色主题', '巨型识别轮廓', '完整人物服装', '内部叙事元素', '左右辅景', '流动线索', '东方留白'],
    promptSkeleton:
      '生成一张竖版国风角色宣传海报。上半部使用 [角色] 的巨型头部/标志轮廓作为第一主体，中下部为完整人物第二主体。轮廓内部和角色周围融合 [叙事元素]，用一条流动线索贯穿上下，边缘水墨晕染和留白，形成系列化高级海报语言。',
    negativePromptFocus: ['角色身份漂移', '轮廓不清', '内部拼贴杂乱', '留白不足', '廉价手游感', '文字乱码'],
  },
  {
    id: 'image-paper-cut-s-landscape',
    name: '新中式撕纸 S 形山水',
    category: '城市与国潮海报',
    description: '适合极简新中式、S 形撕纸裂口、内部东方山水、题字印章和文旅装饰画。',
    primarySignals: ['撕纸', 'S形', '东方美学', 'CHINA'],
    secondarySignals: ['裂痕', '纸艺剪影', '东方山水', '河流', '飞檐翘角', '红色印章', '楷体', '追梦AI'],
    minScore: 2,
    inputFields: ['主题题字', '内部景观', '河流动线', '建筑/山水元素', '日期', '印章文字', '底部英文'],
    promptSkeleton:
      '生成一张极简新中式撕纸山水海报。灰白纹理纸背景被 S 形撕纸裂口打开，内部露出东方山水、蓝色河流、梯田、古风建筑和小船。下方加入 [题字]、日期、红色印章和底部英文，整体安静诗意。',
    negativePromptFocus: ['撕纸效果不明显', 'S 形断裂', '画面拥挤', '文字乱码', '题字过大', '纸张质感塑料化'],
  },
  {
    id: 'image-anime-washi-double-exposure',
    name: '和纸动漫双曝角色海报',
    category: '收藏叙事海报',
    description: '适合动漫半身肖像、月夜山水、浮世绘质感、旧宣纸、竖排题字和浪漫史诗氛围。',
    primarySignals: ['甘露寺蜜璃', '双重曝光', '浮世绘', '旧宣纸'],
    secondarySignals: ['月夜', '神社鸟居', '樱花', '水墨飞白', '竖排毛笔', '红色印章', '反向提示词', '9:16'],
    minScore: 3,
    inputFields: ['角色名称', '角色外观', '服装道具', '内部叙事元素', '竖排题字', '印章文字', '色彩氛围'],
    promptSkeleton:
      '生成一张动漫插画收藏海报。角色半身侧面仰头，头发、肩部和身体轮廓内部融合月夜和风山水世界，包括 [内部叙事元素]。旧宣纸背景、浮世绘质感、水墨飞白、花瓣和烟雾，左侧竖排题字与红色印章低调排布。',
    negativePromptFocus: ['畸形脸', '手指错误', '现代城市', '科幻机械', '3D 渲染', '文字乱码', '水印'],
  },
  {
    id: 'image-realistic-cosplay-magazine-cover',
    name: '真人化 Cosplay 杂志封面',
    category: '人物与封面',
    description: '适合动漫/游戏角色真人化、高端杂志封面、商业摄影布光和高级定制服装转译。',
    primarySignals: ['真人化Cosplay', '高端杂志封面', 'chunli', '角色识别'],
    secondarySignals: ['商业摄影', '8.5头身', '高端写真', '封面排版', '日语主标题', '罗马音', '条形码', '高级定制'],
    minScore: 3,
    inputFields: ['角色名称', '角色识别特征', '发型/服装锁定', '世界观场景', '封面文字系统', '布光方案', '禁用内容'],
    promptSkeleton:
      '生成一张电影级真人化 Cosplay 杂志封面。保留 [角色] 的五官气质、发型、配色、服装轮廓和符号，将其转译为真实人类与高级定制服装。使用商业摄影布光、高端杂志网格排版、日语/罗马字/英文混排和封面细节。',
    negativePromptFocus: ['低俗性感', '廉价 Cosplay', '假发感', '文字重复', '乱码文字', '过度磨皮', '廉价玄幻背景'],
  },
  {
    id: 'image-symbolic-outline-universe-poster',
    name: '轮廓宇宙收藏海报',
    category: '收藏叙事海报',
    description: '适合主题宇宙依附象征轮廓展开的收藏版叙事海报，自动选择最匹配主题的主轮廓。',
    primarySignals: ['轮廓宇宙', '收藏版叙事海报', '主轮廓', '权力的游戏'],
    secondarySignals: ['象征性轮廓', '完整叙事世界', '不要默认瓶子', '水彩刷痕', '纸张颗粒', '大面积留白', '收藏版电影海报'],
    minScore: 3,
    inputFields: ['主题', '主轮廓载体', '主题叙事元素', '象征符号', '空间层次', '色彩方向', '落款'],
    promptSkeleton:
      '根据 [主题] 生成轮廓宇宙收藏版海报。自动选择最有象征意义的主轮廓载体，不默认常规容器。让完整主题世界自然生长在轮廓内部或边界中，包含标志性场景、建筑、符号、角色关系和空间递进，水彩纸张质感、大面积留白、低饱和高级配色。',
    negativePromptFocus: ['普通容器套路', '背景拼接', '生硬裁切', '模板化奇幻素材', '轮廓不清', '内部世界杂乱'],
  },
  {
    id: 'image-side-face-silhouette-epic',
    name: '侧脸剪影史诗叙事海报',
    category: '收藏叙事海报',
    description: '适合人物侧脸剪影内部填充时代世界观、历史叙事、梦幻水彩和低调签名。',
    primarySignals: ['侧脸剪影', '民国篇', '你的签名', '史诗叙事海报'],
    secondarySignals: ['剪影内部', '完整世界观', '标志性场景', '双重曝光式', '梦幻水彩', '纸张颗粒', '签名'],
    minScore: 2,
    inputFields: ['主题', '侧脸身份', '内部世界元素', '时代符号', '色彩方向', '专属签名', '签名位置'],
    promptSkeleton:
      '根据 [主题] 生成收藏版史诗叙事海报。巨大人物侧脸剪影作为外轮廓，剪影内部生长完整世界观、标志性场景、角色关系、建筑和符号。梦幻水彩、纸张颗粒、边缘飞白、大面积留白，并自然加入低调签名。',
    negativePromptFocus: ['剪影轮廓不清', '普通拼贴', '硬裁切', '模板化背景', '元素与主题无关', '签名突兀'],
  },
  {
    id: 'image-face-feature-analysis-card',
    name: '面部特征分析图卡',
    category: '人像分析图卡',
    description: '适合上传人像后自动分析脸型、眼睛、眉毛、鼻子、脸颊和嘴唇，并生成标注式信息图。',
    primarySignals: ['面部特征分析', '脸型', '眼睛', '眉毛'],
    secondarySignals: ['鼻子', '脸颊', '嘴唇', '细箭头', '信息卡片', '圆角', '小图标', '自动分析面部'],
    minScore: 3,
    inputFields: ['人像照片', '标题', '分析部位', '标签风格', '信息卡片样式', '箭头样式', '版面风格'],
    promptSkeleton:
      '根据上传人像生成“面部特征分析”信息图。人像居中，自动检测脸型、眼睛、眉毛、鼻子、脸颊和嘴唇，用细箭头指向每个特征，并用圆角信息卡给出简短标签和 2-3 条真实特征要点。',
    negativePromptFocus: ['身份不一致', '固定模板标签', '箭头指错位置', '卡片遮挡面部', '文字乱码', '长段文字'],
  },
  {
    id: 'image-glasses-fit-guide',
    name: '眼镜搭配指南图卡',
    category: '人像分析图卡',
    description: '适合上传人像后保留真实面部特征，自动分析脸型并生成适合/不适合眼镜试戴对比。',
    primarySignals: ['眼镜搭配指南', '眼镜推荐', '脸型', '试戴'],
    secondarySignals: ['适合', '不适合', '100% 还原面部特征', '圆角卡片', '高级杂志', '并排', '镜框'],
    minScore: 3,
    inputFields: ['人像照片', '标题', '脸型分析', '推荐镜框', '避免镜框', '并排试戴布局', '短标签'],
    promptSkeleton:
      '使用上传人像生成“眼镜搭配指南”信息图。严格保留同一张脸，自动分析脸型与比例，并排展示适合与不适合的镜框试戴效果。使用圆角卡片、细线条、微妙阴影和高级杂志式排版，文字只保留短标签。',
    negativePromptFocus: ['人物不像原图', '脸型改变', '眼镜漂浮', '镜框透视错误', '文字乱码', '长段文字'],
  },
  {
    id: 'image-personal-color-analysis-card',
    name: '个人色彩分析图卡',
    category: '人像分析图卡',
    description: '适合上传人像后保留真实特征，展示适合色、普通色和不适合色的服装上身对比。',
    primarySignals: ['个人色彩分析', '适合色', '不适合色', '形象顾问'],
    secondarySignals: ['膚色', '肤色', '推薦', '避免', '服裝顏色', '色彩分析报告', '社群分享', '图卡', '报告感'],
    minScore: 2,
    inputFields: ['人像照片', '标题', '指定色组', '适合色', '普通色', '避免色', '对比布局', '短标签'],
    promptSkeleton:
      '根据上传人像制作个人色彩分析图卡。保留主角真实五官、肤色和脸型，通过左右或并排方式展示不同服装颜色上身效果，清楚区分适合色、普通色和避免色。版面像专业形象顾问报告，视觉为主，只用短标签。',
    negativePromptFocus: ['人物不像原图', '肤色被严重改变', '脸型变化', '推荐和避免混乱', '长段文字', '低端模板感'],
  },
]

const prompts = await readJsonLines(normalizedPath).catch((error) => {
  throw new Error(`Failed to read ${normalizedPath}: ${error.message}`)
})
const recipe = recipePath ? JSON.parse(await fs.readFile(recipePath, 'utf8')) : createDefaultZrImgsImageRecipe()
const scoredRecipe = scoreRecipeCandidates(recipe, prompts)
const templateDistillation = distillTemplateFamilies(prompts)

await fs.mkdir(inputRoot, { recursive: true })
await fs.writeFile(draftPath, `${JSON.stringify(scoredRecipe.draft, null, 2)}\n`, 'utf8')
await fs.writeFile(reviewPath, createReviewMarkdown(scoredRecipe, prompts), 'utf8')
await fs.writeFile(zlexPath, `${JSON.stringify(scoredRecipe.zlex, null, 2)}\n`, 'utf8')
await fs.writeFile(templateDraftPath, `${JSON.stringify(templateDistillation, null, 2)}\n`, 'utf8')
await fs.writeFile(templateReviewPath, createTemplateReviewMarkdown(templateDistillation), 'utf8')

console.log(`Distilled ${prompts.length} local prompts.`)
console.log(`Draft: ${draftPath}`)
console.log(`Review: ${reviewPath}`)
console.log(`ZLEX: ${zlexPath}`)
console.log(`Template draft: ${templateDraftPath}`)
console.log(`Template review: ${templateReviewPath}`)

function scoreRecipeCandidates(recipe, prompts) {
  const normalizedTexts = prompts.map((item) => normalizeSearchText(item.normalizedPrompt || item.prompt || ''))
  const draft = {
    generatedAt: new Date().toISOString(),
    sourcePromptCount: prompts.length,
    categories: [],
  }
  const zlex = {
    schema: recipe.schema || 'ccks.zlex',
    version: recipe.version || 1,
    scope: recipe.scope || 'system',
    categories: [],
  }

  for (const category of recipe.categories || []) {
    const draftCategory = {
      id: category.id || '',
      name: category.name,
      description: category.description || '',
      variables: [],
    }
    const zlexCategory = {
      id: category.id || '',
      scope: category.scope || 'system',
      icon: category.icon || 'boxes',
      name: category.name,
      description: category.description || '',
      tip: category.tip || '',
      variables: [],
    }

    for (const variable of category.variables || []) {
      const scoredCandidates = readCandidateValues(variable.candidates).map((candidate) => ({
        value: candidate,
        count: countCandidate(normalizedTexts, candidate),
      }))
      const sorted = scoredCandidates.sort((left, right) => right.count - left.count || left.value.localeCompare(right.value, 'zh-Hans-CN'))
      const keep = sorted.filter((item) => item.count > 0).map((item) => item.value)
      const fallback = sorted.map((item) => item.value)
      const candidates = uniqueStrings([...keep, ...fallback]).slice(0, 28)

      draftCategory.variables.push({
        id: variable.id || '',
        variableName: variable.variableName,
        name: variable.name,
        description: variable.description || '',
        content: variable.content || variable.description || '',
        defaultValues: readStringArray(variable.defaultValues),
        multiple: variable.multiple !== false,
        candidates: sorted,
      })
      zlexCategory.variables.push({
        id: variable.id || '',
        scope: variable.scope || 'system',
        variableName: variable.variableName,
        name: variable.name,
        description: variable.description || '',
        content: variable.content || variable.description || '',
        candidates,
        defaultValues: readStringArray(variable.defaultValues),
        multiple: variable.multiple !== false,
      })
    }

    draft.categories.push(draftCategory)
    zlex.categories.push(zlexCategory)
  }

  return { draft, zlex }
}

function distillTemplateFamilies(prompts) {
  const records = prompts.map((item, index) => ({
    hash: item.hash || String(index + 1),
    text: String(item.normalizedPrompt || item.prompt || ''),
    normalizedText: normalizeSearchText(item.normalizedPrompt || item.prompt || ''),
    occurrences: Number.isFinite(Number(item.occurrences)) ? Number(item.occurrences) : 1,
    sourceIdCount: Number.isFinite(Number(item.sourceIdCount)) ? Number(item.sourceIdCount) : 1,
  }))

  const families = TEMPLATE_FAMILY_DEFINITIONS.map((definition) => {
    const matches = []
    for (const record of records) {
      const signalHits = scoreTemplateSignalHits(record.normalizedText, definition)
      if (signalHits.primaryHits === 0) continue
      if (signalHits.score < definition.minScore) continue
      matches.push({ ...record, signalHits })
    }

    const evidenceCount = matches.reduce((sum, item) => sum + item.occurrences, 0)
    const representativeSamples = selectRepresentativeSamples(matches).map((item) => ({
      hash: item.hash,
      occurrences: item.occurrences,
      matchedSignals: item.signalHits.signals,
      prompt: truncateText(item.text, 900),
    }))

    return {
      id: definition.id,
      name: definition.name,
      category: definition.category,
      description: definition.description,
      evidencePromptCount: matches.length,
      evidenceOccurrenceCount: evidenceCount,
      evidenceRate: prompts.length > 0 ? Number((matches.length / prompts.length).toFixed(4)) : 0,
      topSignals: summarizeTemplateSignals(matches),
      inputFields: definition.inputFields,
      promptSkeleton: definition.promptSkeleton,
      negativePromptFocus: definition.negativePromptFocus,
      representativeSamples,
    }
  }).filter((family) => family.evidencePromptCount > 0)

  return {
    generatedAt: new Date().toISOString(),
    sourcePromptCount: prompts.length,
    familyCount: families.length,
    families: families.sort(
      (left, right) =>
        right.evidenceOccurrenceCount - left.evidenceOccurrenceCount ||
        right.evidencePromptCount - left.evidencePromptCount ||
        left.name.localeCompare(right.name, 'zh-Hans-CN'),
    ),
  }
}

function scoreTemplateSignalHits(text, definition) {
  const signals = []
  let score = 0
  let primaryHits = 0

  for (const signal of definition.primarySignals || []) {
    if (!matchesTemplateSignal(text, signal)) continue
    signals.push(signal)
    score += 2
    primaryHits += 1
  }

  for (const signal of definition.secondarySignals || []) {
    if (!matchesTemplateSignal(text, signal)) continue
    signals.push(signal)
    score += 1
  }

  return { score, primaryHits, signals: uniqueStrings(signals) }
}

function matchesTemplateSignal(text, signal) {
  const normalizedSignal = normalizeSearchText(signal)
  return Boolean(normalizedSignal && text.includes(normalizedSignal))
}

function summarizeTemplateSignals(matches) {
  const counts = new Map()
  for (const item of matches) {
    for (const signal of item.signalHits.signals) {
      counts.set(signal, (counts.get(signal) || 0) + item.occurrences)
    }
  }

  return [...counts.entries()]
    .map(([signal, count]) => ({ signal, count }))
    .sort((left, right) => right.count - left.count || left.signal.localeCompare(right.signal, 'zh-Hans-CN'))
    .slice(0, 12)
}

function selectRepresentativeSamples(matches) {
  return [...matches]
    .sort((left, right) => {
      const scoreDiff = right.signalHits.score - left.signalHits.score
      if (scoreDiff !== 0) return scoreDiff
      const occurrenceDiff = right.occurrences - left.occurrences
      if (occurrenceDiff !== 0) return occurrenceDiff
      return right.text.length - left.text.length
    })
    .slice(0, 5)
}

function countCandidate(texts, candidate) {
  const aliases = getCandidateAliases(candidate).map(normalizeSearchText).filter(Boolean)
  let count = 0
  for (const text of texts) {
    if (aliases.some((alias) => text.includes(alias))) count += 1
  }
  return count
}

function getCandidateAliases(candidate) {
  const builtins = {
    人物肖像: ['人物', '肖像', 'portrait', 'person', 'people'],
    女性角色: ['女性', '女孩', '女人', 'female', 'girl', 'woman'],
    男性角色: ['男性', '男孩', '男人', 'male', 'boy', 'man'],
    产品主体: ['产品', '商品', 'product'],
    食品饮品: ['食物', '食品', '饮品', '美食', 'food', 'drink'],
    室内空间: ['室内', 'interior', 'indoor'],
    城市街景: ['城市', '街景', 'city', 'street'],
    自然风景: ['自然', '风景', 'landscape', 'nature'],
    未来城市: ['未来', '科幻城市', 'future city'],
    商业棚拍: ['棚拍', '商业摄影', 'studio'],
    黄金时刻: ['golden hour', '夕阳', '黄昏'],
    霓虹灯光: ['霓虹', 'neon'],
    体积光: ['体积光', 'volumetric'],
    暖色调: ['暖色', 'warm'],
    冷色调: ['冷色', 'cool'],
    写实摄影: ['写实', '摄影', 'photo', 'photorealistic', 'realistic'],
    电影海报: ['电影', '海报', 'cinematic', 'movie poster'],
    '3D渲染': ['3d', '三维', 'render'],
    插画风: ['插画', 'illustration'],
    二次元: ['动漫', 'anime'],
    赛博朋克: ['赛博', 'cyberpunk'],
    金属: ['metal', 'metallic'],
    玻璃: ['glass'],
    皮革: ['leather'],
    织物: ['fabric', 'cloth'],
    高质量: ['高质量', 'quality', 'best quality'],
    超清: ['高清', '超清', 'uhd', 'ultra hd'],
    '8K': ['8k'],
    模糊: ['模糊', 'blur', 'blurry'],
    水印: ['水印', 'watermark'],
    logo: ['logo'],
  }
  return [candidate, ...(builtins[candidate] || [])]
}

function createReviewMarkdown(result, prompts) {
  const lines = [
    '# ZrImgs 配方变量蒸馏审阅稿',
    '',
    `- 本地提示词数量：${prompts.length}`,
    `- 生成时间：${result.draft.generatedAt}`,
    '',
  ]

  for (const category of result.draft.categories) {
    lines.push(`## ${readPlainText(category.name)}`, '', readPlainText(category.description), '')
    for (const variable of category.variables) {
      const top = variable.candidates.slice(0, 10).map((item) => `${item.value}(${item.count})`).join(' / ')
      lines.push(`- **${readPlainText(variable.name)}** \`${variable.variableName}\`：${top}`)
    }
    lines.push('')
  }

  return `${lines.join('\n')}\n`
}

function createTemplateReviewMarkdown(result) {
  const lines = [
    '# ZrImgs 模板蒸馏审阅稿',
    '',
    `- 本地提示词数量：${result.sourcePromptCount}`,
    `- 模板家族数量：${result.familyCount}`,
    `- 生成时间：${result.generatedAt}`,
    '',
    '## 使用方式',
    '',
    '1. 先查看每个模板家族的命中数量和代表样本，判断是否需要合并或拆分模板。',
    '2. 将“建议输入字段”和“提示词骨架”作为模板 tab 的正文基础。',
    '3. 如果某个家族命中少但样本质量高，可以保留为专业模板；如果命中多但样本分散，优先拆成更窄模板。',
    '',
  ]

  for (const family of result.families) {
    const signalText = family.topSignals.map((item) => `${item.signal}(${item.count})`).join(' / ') || '无明显信号'
    lines.push(
      `## ${family.name}`,
      '',
      `- 分类：${family.category}`,
      `- 命中提示词：${family.evidencePromptCount}`,
      `- 命中记录数：${family.evidenceOccurrenceCount}`,
      `- 命中率：${(family.evidenceRate * 100).toFixed(2)}%`,
      `- 方向：${family.description}`,
      `- 高频信号：${signalText}`,
      `- 建议输入字段：${family.inputFields.join(' / ')}`,
      `- 负面约束重点：${family.negativePromptFocus.join(' / ')}`,
      '',
      '提示词骨架：',
      '',
      '```text',
      family.promptSkeleton,
      '```',
      '',
      '代表样本：',
      '',
    )

    if (family.representativeSamples.length === 0) {
      lines.push('- 暂无命中样本。', '')
      continue
    }

    family.representativeSamples.forEach((sample, index) => {
      const signals = sample.matchedSignals.join(' / ') || '无'
      lines.push(`${index + 1}. (${sample.occurrences}) ${signals}`, '', sample.prompt, '')
    })
  }

  return `${lines.join('\n')}\n`
}

async function readJsonLines(filePath) {
  const content = await fs.readFile(filePath, 'utf8')
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

function parseArgs(args) {
  const parsed = {}
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (!arg.startsWith('--')) continue
    const key = arg.slice(2)
    const next = args[index + 1]
    if (!next || next.startsWith('--')) parsed[key] = '1'
    else {
      parsed[key] = next
      index += 1
    }
  }
  return parsed
}

function normalizeSearchText(value) {
  return String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
}

function readCandidateValues(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean)
  if (value && typeof value === 'object') {
    const zh = readCandidateValues(value.zh)
    const en = readCandidateValues(value.en)
    return uniqueStrings([...zh, ...en])
  }
  if (typeof value === 'string') return value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean)
  return []
}

function readStringArray(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean)
  if (typeof value === 'string') return value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean)
  return []
}

function readPlainText(value) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') return String(value.zh || value.en || '').trim()
  return ''
}

function uniqueStrings(values) {
  const seen = new Set()
  const result = []
  for (const value of values) {
    const key = normalizeSearchText(value)
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(value)
  }
  return result
}

function truncateText(value, maxLength) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1)}…`
}

function createDefaultZrImgsImageRecipe() {
  return {
    schema: 'ccks.zlex',
    version: 1,
    scope: 'system',
    categories: [
    {
      id: 'camera',
      scope: 'system',
      icon: 'aperture',
      name: '镜头语言',
      description: '图片生成中的视角、镜头、景别和画幅控制。',
      variables: [
        {
          id: 'shot-size',
          variableName: 'shotSize',
          name: '景别',
          description: '定义主体在画面中的占比。',
          candidates: ['大特写', '特写', '半身像', '中景', '全身像', '远景', '大全景', '俯拍全景', '产品近景', '环境肖像', '细节切片', '建立镜头'],
          defaultValues: ['中景'],
          multiple: false,
        },
        {
          id: 'camera-angle',
          variableName: 'cameraAngle',
          name: '拍摄角度',
          description: '控制视角高度、方向和观看关系。',
          candidates: ['正面视角', '侧面视角', '三分之四视角', '俯拍', '仰拍', '鸟瞰视角', '低角度视角', '过肩视角', '背影视角', '近距离平视', '斜侧视角', '第一人称视角'],
          defaultValues: ['正面视角'],
          multiple: false,
        },
      ],
    },
    {
      id: 'visual-style',
      scope: 'system',
      icon: 'palette',
      name: '视觉风格',
      description: '图片生成中的光线、色调、构图、风格和渲染方法。',
      variables: [
        {
          id: 'lighting',
          variableName: 'lighting',
          name: '光线',
          description: '控制光源类型和明暗关系。',
          candidates: ['黄金时刻', '霓虹灯光', '体积光', '自然光', '轮廓光', '逆光', '柔和光', '侧光', '顶光', '高对比光影', '蓝调时刻', '工作室布光', '伦勃朗光', '低调光', '窗边光', '散射光', '硬光阴影', '舞台追光'],
          defaultValues: ['自然光'],
          multiple: true,
        },
        {
          id: 'color-tone',
          variableName: 'colorTone',
          name: '色调',
          description: '定义整体颜色温度和饱和倾向。',
          candidates: ['暖色调', '冷色调', '低饱和', '高饱和', '复古胶片色', '清新明亮', '粉彩色', '单色调', '黑金配色', '莫兰迪色', '赛博霓虹色', '暗黑氛围', '高端灰', '糖果色', '自然大地色', '青橙电影色', '品牌主色突出'],
          defaultValues: ['暖色调'],
          multiple: false,
        },
        {
          id: 'composition',
          variableName: 'composition',
          name: '构图',
          description: '约束主体、空间和视觉动线。',
          candidates: ['层次分明', '留白构图', '对称构图', '前景遮挡', '背景虚化', '低角度构图', '居中构图', '视觉引导线', '主体突出', '对角线构图', '三分法构图', '框中框构图', '密集排版构图', '极简构图', '开放式构图', '海报式中心构图'],
          defaultValues: ['三分法构图'],
          multiple: true,
        },
        {
          id: 'visual-style-direction',
          variableName: 'visualStyle',
          name: '画面风格',
          description: '定义图片的整体画风、媒介和视觉参考方向。',
          candidates: ['电影海报', '写实摄影', '二次元', '插画风', '3D渲染', '赛博朋克', '国风', '油画', '高级时尚', '水彩', '极简主义', '商业海报', '科幻概念', '低多边形', '梦幻童话', '像素艺术', '蒸汽波', '黏土风', '扁平矢量', '儿童绘本', '暗黑奇幻', '产品广告大片'],
          defaultValues: ['写实摄影'],
          multiple: true,
        },
        {
          id: 'render-method',
          variableName: 'renderMethod',
          name: '渲染方式',
          description: '定义图片的摄影、引擎、材质或后期处理方法。',
          candidates: ['HDR', 'Unreal Engine', '真实摄影', '胶片质感', '高动态范围', 'PBR材质', 'Blender', 'Octane Render', '产品级渲染', '后期精修', '景深渲染', 'Cycles渲染', '全局光照', '路径追踪', '手绘笔触', '矢量渲染'],
          defaultValues: ['真实摄影'],
          multiple: true,
        },
      ],
    },
    {
      id: 'subject',
      scope: 'system',
      icon: 'user-round',
      name: '主体设定',
      description: '图片主体、动作状态、材质、细节和情绪氛围。',
      variables: [
        {
          id: 'subject-type',
          variableName: 'subjectType',
          name: '主体类型',
          description: '图片中最主要的对象、角色或产品类型。',
          candidates: ['男性角色', '女性角色', '人物肖像', '产品主体', '食品饮品', '建筑', '猫', '狗', '儿童', '车辆', '动物', '机器人', '情侣', '鸟类', '奇幻生物', '团队合影', '植物花卉', '虚拟主播', 'IP吉祥物', '家居物件', '服装穿搭', '电子设备'],
          defaultValues: ['人物肖像'],
          multiple: true,
        },
        {
          id: 'pose',
          variableName: 'pose',
          name: '主体姿态',
          description: '控制主体动作和身体状态。',
          candidates: ['微笑', '站立', '悬浮', '坐姿', '回眸', '奔跑', '战斗姿态', '手持物品', '展示产品', '动态瞬间', '互动交流', '静物摆放', '凝视镜头', '舞台表演', '优雅姿态', '跳跃', '行走', '低头沉思', '转身瞬间', '使用设备'],
          defaultValues: ['站立'],
          multiple: false,
        },
        {
          id: 'material',
          variableName: 'material',
          name: '材质风格',
          description: '描述主体或关键物件的材质表现。',
          candidates: ['织物', '玻璃', '金属', '皮革', '皮肤质感', '塑料', '丝绸', '纸张', '水晶', '水面', '烟雾', '毛发', '石材', '陶瓷', '木材', '珠宝光泽', '橡胶', '亚克力', '哑光涂层', '拉丝金属'],
          defaultValues: ['织物'],
          multiple: true,
        },
        {
          id: 'mood',
          variableName: 'mood',
          name: '情绪氛围',
          description: '控制画面情绪和叙事气质。',
          candidates: ['夜晚', '安静', '神秘', '清晨', '梦幻', '黄昏', '高级感', '温馨', '未来感', '雨天', '节日氛围', '热闹', '雪景', '复古感', '商业大片氛围', '雾气弥漫', '孤独感', '治愈感', '紧张感', '史诗感'],
          defaultValues: ['梦幻'],
          multiple: true,
        },
        {
          id: 'detail-level',
          variableName: 'detailLevel',
          name: '细节增强',
          description: '用于提升画面精细程度、质感和局部表现。',
          candidates: ['层次丰富', '高级质感', '丰富细节', '复杂装饰', '细腻皮肤', '精密结构', '干净轮廓', '高光点缀', '精致纹理', '清晰边缘', '微小颗粒', '真实反射', '自然瑕疵', '手工痕迹', '产品倒角清晰'],
          defaultValues: ['高级质感'],
          multiple: true,
        },
      ],
    },
    {
      id: 'image-output',
      scope: 'system',
      icon: 'boxes',
      name: '图片输出',
      description: '图片生成的场景、用途、质量和负面约束。',
      variables: [
        {
          id: 'scene-type',
          variableName: 'sceneType',
          name: '场景类型',
          description: '主体所在的主要空间、背景或环境类型。',
          candidates: ['自然风景', '室内空间', '城市街景', '商业棚拍', '卧室', '办公室', '厨房', '未来城市', '花园', '森林', '咖啡馆', '海边', '山脉', '舞台', '展厅', '赛博朋克街区', '宇宙星空', '校园', '工厂车间', '美术馆', '街头夜市', '豪华酒店'],
          defaultValues: ['室内空间'],
          multiple: true,
        },
        {
          id: 'design-use',
          variableName: 'designUse',
          name: '设计用途',
          description: '生成图片面向的业务、展示或发布场景。',
          candidates: ['海报', '头像', '壁纸', '封面图', '品牌视觉', '活动宣传图', '电商主图', '角色设定图', '概念设计', '产品展示图', '故事插画', '广告图', '社交媒体配图', '小红书封面', '公众号首图', 'APP启动页', '商品详情图', 'PPT封面'],
          defaultValues: ['海报'],
          multiple: true,
        },
        {
          id: 'image-quality',
          variableName: 'imageQuality',
          name: '质量描述',
          description: '生成结果需要达到的清晰度、完成度和专业标准。',
          candidates: ['高质量', '8K', '超清', '细节丰富', '无水印', '专业摄影', '干净背景', '真实质感', '大师级作品', '全局光照', '电影级调色', '锐利对焦', '高端质感', '精细渲染', '商业成片', '清晰主体', '低噪点', '自然皮肤质感'],
          defaultValues: ['高质量'],
          multiple: true,
        },
        {
          id: 'negative-quality',
          variableName: 'negativeQuality',
          name: '负面约束',
          description: '不希望出现在画面中的低质量表现或干扰元素。',
          candidates: ['logo', '模糊', '水印', '边框', '噪点', '低清晰度', '过曝', '低质量', '畸变', '比例错误', '多余手指', '文字错误', '裁切主体', '欠曝', '手部错误', '压缩伪影', '重复主体', '脸部崩坏', '错误透视', '杂乱背景', '不自然皮肤', '过度锐化'],
          defaultValues: ['模糊', '水印', '低质量'],
          multiple: true,
        },
      ],
    },
    ],
  }
}
