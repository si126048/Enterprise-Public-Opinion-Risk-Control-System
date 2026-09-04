var MOCK_STATS = {
    total_count: 21357,
    negative_count: 14280,
    negative_rate: 0.669,
    high_risk_count: 4320,
    medium_risk_count: 8650,
    low_risk_count: 8387,
    community_heat_score: 78.5,
    product_distribution: {
        '原神': 8420,
        '崩坏：星穹铁道': 6180,
        '绝区零': 4250,
        '未定事件簿': 1380,
        '公司层面': 1127
    },
    platform_distribution: {
        '微博': 7250,
        '小红书': 3890,
        '知乎': 3460,
        'B站': 4700,
        'TapTap': 2057
    },
    trend_data: {
        dates: ['08-29', '08-30', '08-31', '09-01', '09-02', '09-03', '09-04'],
        total: [1820, 2150, 1960, 2340, 2580, 2210, 2097],
        negative: [1180, 1450, 1320, 1580, 1720, 1490, 1390]
    },
    sentiment_overall: {
        positive: 3420,
        neutral: 3657,
        negative: 14280
    },
    high_risk_samples: [
        {
            id: 'evt_001',
            title: '原神5.0版本更新后玩家大规模吐槽内容量不足',
            platform: '微博',
            sentiment: 'negative',
            risk_level: 'high',
            publish_time: '2026-09-03 14:22:00',
            heat_score: 92
        },
        {
            id: 'evt_002',
            title: '崩铁抽卡概率争议登上热搜榜',
            platform: '微博',
            sentiment: 'negative',
            risk_level: 'high',
            publish_time: '2026-09-02 09:15:00',
            heat_score: 88
        },
        {
            id: 'evt_003',
            title: '绝区零PC端严重BUG导致大面积闪退',
            platform: 'B站',
            sentiment: 'negative',
            risk_level: 'high',
            publish_time: '2026-09-01 20:30:00',
            heat_score: 85
        },
        {
            id: 'evt_004',
            title: '米哈游CEO社交媒体发言引发股价波动',
            platform: '知乎',
            sentiment: 'negative',
            risk_level: 'high',
            publish_time: '2026-08-31 16:45:00',
            heat_score: 95
        },
        {
            id: 'evt_005',
            title: '未定事件簿玩家联名投诉角色削弱',
            platform: 'TapTap',
            sentiment: 'negative',
            risk_level: 'high',
            publish_time: '2026-08-30 11:20:00',
            heat_score: 76
        }
    ]
};
