/**
 * MODEL: Data_Layer
 * VERSION: V.4.9.0
 * DESCRIPTION: Absolute Zero State (Empty default plans)
 */

const PRICING_PLANS = {
    MAIN: [
        { id: 'p_single', name: '單堂計費', sessions: 1, price: 800 },
        { id: 'p_3m_10', name: '三個月 10 堂', sessions: 10, price: 7000 },
        { id: 'p_2m_8', name: '兩個月 8 堂', sessions: 8, price: 4800 },
        { id: 'p_2m_16', name: '兩個月 16 堂', sessions: 16, price: 7200 }
    ],
    TRAINING: [
        { id: 't_none', name: '無集訓', price: 0 },
        { id: 't_one', name: '集訓一項', price: 1000 },
        { id: 't_two', name: '集訓兩項以上', price: 1500 }
    ]
};

const WEEKLY_SCHEDULE = {
    1: [ { id: 'mon_01', time: '18:00–19:00', name: '兒童體適能' }, { id: 'mon_02', time: '19:20–20:40', name: '初階對練' } ],
    2: [ { id: 'tue_01', time: '18:00–19:20', name: '初階班' }, { id: 'tue_02', time: '19:40–21:00', name: '高階班' } ],
    3: [ { id: 'wed_01', time: '18:00–19:20', name: '高階班' }, { id: 'wed_02', time: '19:40–21:00', name: '初階班' } ],
    4: [ { id: 'thu_01', time: '18:00–19:20', name: '初階班' }, { id: 'thu_02', time: '19:20–21:20', name: '對練班' } ],
    5: [ { id: 'fri_01', time: '18:00–19:20', name: '初階班' }, { id: 'fri_02', time: '19:40–21:00', name: '高階班' } ],
    6: [
        { id: 'sat_01', time: '09:30–10:50', name: '初階班' }, { id: 'sat_02', time: '11:00–12:00', name: '兒童體適能' },
        { id: 'sat_03', time: '13:00–14:20', name: '高階班' }, { id: 'sat_04', time: '15:30–17:30', name: '對練班' },
        { id: 'sat_in_01', time: '09:30–11:30', name: '集訓:對練(早)' }, { id: 'sat_in_02', time: '13:30–15:30', name: '集訓:對練(午)' },
        { id: 'sat_in_03', time: '13:30–15:00', name: '集訓:公認品勢' }, { id: 'sat_in_04', time: '15:15–16:45', name: '集訓:自由品勢' }
    ],
    0: [ { id: 'sun_01', time: '10:00–11:20', name: '高階班' }, { id: 'sun_02', time: '13:00–14:20', name: '初階班' }, { id: 'sun_03', time: '14:30–15:30', name: '兒童體適能' } ]
};

const RAW_NAMES_STR = `方庭祐,吳承熙,連紹洋,曾品睿,林朔禾,林子甯,黃苡瑄,朱薇伊,羅少廷,沈佑安,黃奕翔,張哲睿,張筑媗,吳易栩,王嘉安,謝濰羽,陳定恩,陳品言,許豪文,洪昕語,洪宇軒,王鼎鈞,阿珞盟,林宸妤,林筠恩,黃士展,廖子煬,張式齡,吳宣劭,周元皓,李晨寧,廖胤安,洪婕寧,鄭穎達,李亮瑾,林楷諺,林歆蓉,石承晏,石澄霏,黃于恩,賴杰昕,賴承昕,方曦霈,張軒旗,王顗誠,吳宇軒,林又妍,林又彤,鄭宇恩,劉宥霆,陳柏宇,林譜雷,林安聲,彭柏銓,萬姿妤,駱亭婷,曾恩頎,邱亦寧,邱至瑄,宋其蓁,宋其叡,張力翔,王宥杰,李忻容,李柏融,温東荃,陳仕閔,舒柏瑜,吳奕潔,洪米柔,倪秉秝,倪秉稑,黎士銘,張允宸,曾芯瑜,蔡詠臣,李晨新,黃昱衡,施泓樂,施建辰,陳亭瑜,林旻睿,倪貫綸,倪康皓,王芙蓉,高瑀嬨,張語芯,周書妍,鄭詠晴,陳牧謙,何予默,SAANVI,吳睿甯,李秉澔,陳冠宇,許哲彰,許展韶,徐梓恩,高鉑淵,林瑋宸,姚祥琦,姚祥晞,蔣彥柏,李佳芸`;
const NAME_ARRAY = RAW_NAMES_STR.split(',').map(n => n.trim()).filter(n => n.length > 0);

function initDB() {
    let currentData = localStorage.getItem('tkd_db_students');
    let needsSave = false;
    let students = currentData ? JSON.parse(currentData) : [];

    if (students.length === 0) {
        students = NAME_ARRAY.map((name, index) => ({
            id: 'stu_' + (1000 + index),
            name: name,
            phone: '',
            emergency: '',
            groupId: '', 
            activePlans: [], // V4.9 徹底清空預設方案
            trainingId: 't_none',
            balance: 0,
            accumulated: 0,
            globalNote: '',
            active: true
        }));
        needsSave = true;
    } else {
        students.forEach(s => {
            if (s.mainPlanId && (!s.activePlans || s.activePlans.length === 0)) {
                s.activePlans = [s.mainPlanId];
                delete s.mainPlanId;
                needsSave = true;
            }
            if (!s.activePlans) s.activePlans = []; 
            if (s.groupId === undefined) { s.groupId = ''; needsSave = true; }
        });
    }

    if (needsSave) localStorage.setItem('tkd_db_students', JSON.stringify(students));
    if (!localStorage.getItem('tkd_db_attendance')) localStorage.setItem('tkd_db_attendance', JSON.stringify({}));
}

window.TKD_DATA = { PRICING: PRICING_PLANS, SCHEDULE: WEEKLY_SCHEDULE, RAW_NAMES: NAME_ARRAY, init: initDB };

