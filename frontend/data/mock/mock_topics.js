var MOCK_TOPICS = [
    {
        topic_id: 'G001',
        name: '版本节奏与内容',
        definition: '玩家对版本更新频率、内容量、活动设计的不满，包括长草期过长、版本内容空洞、活动重复等',
        anchors: [
            '已经长草两个月了，每天上线就是日常五分钟下线，这版本到底在更新什么？',
            '活动又是换皮签到，奖励还缩水了，策划是不是觉得玩家没脾气？',
            '新版本就出了两个角色一个副本，内容量也太少了吧，隔壁游戏都出大版本了',
            '每次版本都是这些破活动，毫无新意，退坑算了'
        ],
        content_count: 3842,
        negative_rate: 0.72,
        platform_distribution: { weibo: 1200, xiaohongshu: 860, zhihu: 520, bilibili: 980, taptap: 282, xiaoheihe: 340, miyoushe: 420 }
    },
    {
        topic_id: 'G002',
        name: '抽卡与付费机制',
        definition: '关于抽卡概率、保底机制、付费性价比的争议，包括氪金体验差、概率不透明、保底过高等',
        anchors: [
            '大保底才出，这概率真的合理吗？隔壁游戏都是小保底必出UP',
            '一个版本氪了三千多，结果啥都没拿到，这付费体验太差了',
            '月卡涨价？你凭什么涨价？福利有增加吗？',
            '抽卡动画看了八百遍了，能不能换个新的，反正都是骗氪'
        ],
        content_count: 4215,
        negative_rate: 0.81,
        platform_distribution: { weibo: 1450, xiaohongshu: 920, zhihu: 680, bilibili: 780, taptap: 385, xiaoheihe: 410, miyoushe: 490 }
    },
    {
        topic_id: 'G003',
        name: '角色设计与平衡',
        definition: '角色强度平衡、外观设计、人设争议，包括角色削弱、设计同质化、CP争议等',
        anchors: [
            '新角色又削弱了，抽了还没捂热就砍，以后谁还敢抽新角色？',
            '这角色设计跟上一个有什么区别？换个颜色就拿出来卖？',
            '剧情里这个角色的人设崩了，跟之前完全不一样，编剧换人了？',
            '为什么每次出新角色都要踩老角色，非得搞对立？'
        ],
        content_count: 2960,
        negative_rate: 0.58,
        platform_distribution: { weibo: 980, xiaohongshu: 720, zhihu: 380, bilibili: 640, taptap: 240, xiaoheihe: 260, miyoushe: 310 }
    },
    {
        topic_id: 'G004',
        name: '技术性能与优化',
        definition: '游戏性能优化、BUG问题、适配兼容性等技术层面投诉',
        anchors: [
            '更新后手机烫得能煎蛋，帧率掉到20，这优化水平真的无语',
            'PC端又崩了，进游戏就闪退，什么时候能修好？',
            'BUG越来越多了，穿模、卡任务、贴图错误，测试团队是摆设吗？',
            'iPad pro都跑不动最高画质，你们的游戏优化能不能上点心？'
        ],
        content_count: 1850,
        negative_rate: 0.85,
        platform_distribution: { weibo: 420, xiaohongshu: 310, zhihu: 280, bilibili: 380, taptap: 460, xiaoheihe: 180, miyoushe: 220 }
    },
    {
        topic_id: 'G005',
        name: '社区运营与公关',
        definition: '官方社区管理、公关回应、玩家沟通等方面的争议，包括冷处理、删帖、不当言论等',
        anchors: [
            '官方又在装死了，这么大的节奏就是不出公告，冷处理有意思吗？',
            '论坛里提个意见就被删帖封号，这就是你们的社区运营？',
            '策划直播说了一堆废话，玩家关心的问题一个没回应',
            '官方群管随便踢人，提BUG的踢，反馈问题的踢，只会捂嘴'
        ],
        content_count: 3120,
        negative_rate: 0.78,
        platform_distribution: { weibo: 1100, xiaohongshu: 520, zhihu: 480, bilibili: 720, taptap: 300, xiaoheihe: 280, miyoushe: 350 }
    },
    {
        topic_id: 'G006',
        name: '竞品与市场压力',
        definition: '与竞品对比产生的流失风险、市场份额变化、玩家迁移等',
        anchors: [
            '隔壁新游画质碾压，这边还在吃老本，再不改进真没人玩了',
            '朋友都跑去玩新游戏了，就剩我一个人在这单机',
            '这个月流水跌了多少？看看人家新游戏首月多少亿',
            '说实话这游戏已经过时了，该退就退吧'
        ],
        content_count: 1680,
        negative_rate: 0.65,
        platform_distribution: { weibo: 520, xiaohongshu: 380, zhihu: 320, bilibili: 340, taptap: 120, xiaoheihe: 150, miyoushe: 180 }
    },
    {
        topic_id: 'G007',
        name: '公司治理与舆情',
        definition: '公司层面争议，包括管理层言论、企业文化、员工事件、股价影响等',
        anchors: [
            'CEO又在社交媒体乱说话了，每次上热搜都是负面，能不能消停点？',
            '股价又跌了，投资者都在问公司到底怎么了',
            '内部员工爆料加班文化太严重，这公司把人当耗材',
            '公司高管套现减持，对自家游戏都没信心了？'
        ],
        content_count: 2450,
        negative_rate: 0.74,
        platform_distribution: { weibo: 980, xiaohongshu: 320, zhihu: 520, bilibili: 380, taptap: 250, xiaoheihe: 200, miyoushe: 240 }
    },
    {
        topic_id: 'G008',
        name: '合规与监管',
        definition: '版号政策、未成年人保护、数据安全、跨境合规等监管风险',
        anchors: [
            '听说又要加强未成年限制了，这下真的完了',
            '海外版本数据合规问题被调查了？这影响可不小',
            '版号又没拿到，下个版本能不能按时上？',
            '游戏内充值限额了，这对营收影响太大了'
        ],
        content_count: 1240,
        negative_rate: 0.68,
        platform_distribution: { weibo: 420, xiaohongshu: 180, zhihu: 280, bilibili: 220, taptap: 140, xiaoheihe: 100, miyoushe: 120 }
    }
];
