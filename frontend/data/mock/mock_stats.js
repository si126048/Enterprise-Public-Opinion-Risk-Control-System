var MOCK_STATS = {
    total_count: 2847,
    analyzed_count: 2847,
    negative_rate: 0.236,
    high_risk_count: 42,
    topic_count: 8,
    source_count: 5,
    daily_trend: [
        { date: '2026-08-28', count: 156 },
        { date: '2026-08-29', count: 189 },
        { date: '2026-08-30', count: 142 },
        { date: '2026-08-31', count: 203 },
        { date: '2026-09-01', count: 178 },
        { date: '2026-09-02', count: 215 },
        { date: '2026-09-03', count: 164 }
    ],
    risk_distribution: { high: 42, medium: 312, low: 2493 },
    recent_high_risk: [
        {
            id: 'hr_001',
            title: '翠湖小区电梯频繁故障困人',
            source: 'grid_hotline',
            publish_time: '2026-09-02',
            clean_text: '翠湖小区3栋电梯近一个月内已发生故障4次，老人小孩被困多次，物业迟迟不予彻底维修，居民出行安全受到严重威胁。'
        },
        {
            id: 'hr_002',
            title: '黑林铺社区消防设施全面缺失',
            source: 'community_report',
            publish_time: '2026-09-01',
            clean_text: '黑林铺社区老旧住宅楼道内灭火器全部过期，消防栓无水，部分安全出口被杂物堵塞，一旦发生火灾后果不堪设想。'
        },
        {
            id: 'hr_003',
            title: '龙翔街道群租房安全隐患极大',
            source: 'community_report',
            publish_time: '2026-09-01',
            clean_text: '龙翔街道麻园片区群租房现象严重，一套三居室被隔成八间出租，电线私拉乱接，燃气使用不规范，安全隐患极大。'
        },
        {
            id: 'hr_004',
            title: '普吉街道渣土车夜间超速酿事故',
            source: 'grid_hotline',
            publish_time: '2026-08-30',
            clean_text: '普吉街道滇缅大道夜间渣土车超速行驶、闯红灯现象严重，已发生两起交通事故，周边居民出行安全受到严重威胁。'
        },
        {
            id: 'hr_005',
            title: '西翥街道山体滑坡威胁居民安全',
            source: 'community_report',
            publish_time: '2026-08-29',
            clean_text: '西翥街道某山坡在连续降雨后出现裂缝和局部滑坡迹象，下方十余户居民安全受到威胁，请紧急组织勘查和转移。'
        }
    ],
    district_stats: {
        '华山街道': { total: 342, negative: 89, high_risk: 5, top_issue: '物业管理' },
        '大观街道': { total: 287, negative: 72, high_risk: 4, top_issue: '市容环境' },
        '普吉街道': { total: 215, negative: 58, high_risk: 3, top_issue: '交通出行' },
        '莲华街道': { total: 198, negative: 45, high_risk: 2, top_issue: '教育入学' },
        '龙翔街道': { total: 312, negative: 82, high_risk: 6, top_issue: '物业管理' },
        '丰宁街道': { total: 256, negative: 67, high_risk: 4, top_issue: '市容环境' },
        '红云街道': { total: 278, negative: 71, high_risk: 5, top_issue: '社会保障' },
        '黑林铺街道': { total: 234, negative: 55, high_risk: 3, top_issue: '公共安全' },
        '西翥街道': { total: 189, negative: 48, high_risk: 2, top_issue: '医疗卫生' },
        '沙朗街道': { total: 156, negative: 39, high_risk: 1, top_issue: '文化服务' }
    }
};
