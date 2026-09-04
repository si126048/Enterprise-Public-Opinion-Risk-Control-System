var MOCK_TOPICS = [
    {
        id: 'topic_001',
        name: '物业管理',
        definition: '物业不作为、设施维修拖延、业主与物业纠纷',
        count: 342,
        negative_rate: 0.674,
        anchors: ['楼道灯坏了几个月没人修', '电梯经常出故障', '物业收费不透明'],
        sentiment_distribution: { positive: 12, neutral: 88, negative: 242 },
        risk_distribution: { low: 180, medium: 100, high: 62 }
    },
    {
        id: 'topic_002',
        name: '市容环境',
        definition: '垃圾清运不及时、道路破损、绿化缺失、违建问题',
        count: 418,
        negative_rate: 0.583,
        anchors: ['垃圾桶满了三天没人清', '路面坑坑洼洼下雨积水', '行道树被砍没人补种'],
        sentiment_distribution: { positive: 45, neutral: 118, negative: 255 },
        risk_distribution: { low: 235, medium: 128, high: 55 }
    },
    {
        id: 'topic_003',
        name: '交通出行',
        definition: '公交线路不合理、道路拥堵、停车困难、交通设施缺失',
        count: 289,
        negative_rate: 0.512,
        anchors: ['公交站离小区太远走路要二十分钟', '高峰期堵一个多小时过不了路口', '小区周围找不到停车位'],
        sentiment_distribution: { positive: 18, neutral: 106, negative: 165 },
        risk_distribution: { low: 162, medium: 89, high: 38 }
    },
    {
        id: 'topic_004',
        name: '教育入学',
        definition: '学区划分争议、学位紧张、培训机构乱象、校园安全',
        count: 198,
        negative_rate: 0.424,
        anchors: ['对口学校太远接送困难', '幼儿园学位不够摇号落选', '学校门口交通混乱不安全'],
        sentiment_distribution: { positive: 22, neutral: 76, negative: 100 },
        risk_distribution: { low: 118, medium: 56, high: 24 }
    },
    {
        id: 'topic_005',
        name: '医疗卫生',
        definition: '基层医疗资源不足、药品短缺、就医体验差、公共卫生隐患',
        count: 256,
        negative_rate: 0.547,
        anchors: ['社区医院常用药经常断货', '排队两小时看病五分钟', '偏远社区老人看病跑很远'],
        sentiment_distribution: { positive: 15, neutral: 85, negative: 156 },
        risk_distribution: { low: 135, medium: 78, high: 43 }
    },
    {
        id: 'topic_006',
        name: '社会保障',
        definition: '低保审批慢、社保办理繁琐、养老服务不足、就业帮扶不到位',
        count: 312,
        negative_rate: 0.491,
        anchors: ['低保申请交了半年没结果', '社保窗口排队排到门外', '社区养老床位一位难求'],
        sentiment_distribution: { positive: 28, neutral: 108, negative: 176 },
        risk_distribution: { low: 178, medium: 92, high: 42 }
    },
    {
        id: 'topic_007',
        name: '公共安全',
        definition: '消防安全隐患、治安问题、噪音扰民、食品安全',
        count: 367,
        negative_rate: 0.613,
        anchors: ['消防通道被车堵死了进不去', '晚上噪音太大根本睡不着', '学校门口卖三无食品给孩子吃'],
        sentiment_distribution: { positive: 10, neutral: 98, negative: 259 },
        risk_distribution: { low: 168, medium: 112, high: 87 }
    },
    {
        id: 'topic_008',
        name: '文化服务',
        definition: '公共文化设施不足、活动场地缺乏、文化遗产保护不力',
        count: 156,
        negative_rate: 0.312,
        anchors: ['社区图书馆开门时间短周末还关门', '文化广场健身器材坏了没人修', '农村书屋书籍太少种类单一'],
        sentiment_distribution: { positive: 32, neutral: 68, negative: 56 },
        risk_distribution: { low: 102, medium: 42, high: 12 }
    }
];
