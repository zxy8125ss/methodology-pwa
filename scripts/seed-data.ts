/**
 * 种子数据 —— 八大领域 + 首批经典方法论档案
 *
 * 这些档案是「已知公开事实」的基础整理，用于让系统开箱可用；
 * 后续的 AI 研究会在此基础上深化、补充证据与建立关联。
 *
 * 用法：npm run data:seed
 */

import { GitHubClient, DataRepo } from '../shared/repo/github.js';
import {
  DOMAIN_IDS,
  DOMAIN_DEFAULT_NAMES,
  type CaseStudy,
  type Domain,
  type Method,
  type Relation,
  type Source,
} from '../shared/types.js';

const OWNER = process.env.GITHUB_OWNER ?? 'zxy8125ss';
const REPO = process.env.GITHUB_REPO ?? 'methodology-data';
const BRANCH = process.env.DATA_REPO_BRANCH ?? 'main';
const TOKEN =
  process.env.GITHUB_TOKEN_DATA ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? '';

const NOW = new Date().toISOString();

/** 八大领域 —— 支持动态扩展，这里是初始集合 */
const domains: Domain[] = DOMAIN_IDS.map((id, index) => ({
  id,
  name: DOMAIN_DEFAULT_NAMES[id],
  description: '',
  parentId: null,
  order: index,
  keywords: [],
  createdAt: NOW,
  updatedAt: NOW,
}));

/** 来源 —— 只登记可核实的公开出版物 */
const sources: Source[] = [
  {
    id: 'src_pdca_original',
    title: 'The Plan-Do-Check-Act Cycle（PDCA 的原始表述与质量管理应用）',
    authorOrOrg: 'Walter A. Shewhart / W. Edwards Deming',
    url: null,
    publishedAt: null,
    accessedAt: NOW,
    type: 'book',
    credibility: 0.9,
    supports: ['PDCA 循环的四个阶段划分与质量管理起源'],
    publisher: null,
    isbn: null,
    doi: null,
    language: 'en',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'src_deming_out_of_crisis',
    title: 'Out of the Crisis',
    authorOrOrg: 'W. Edwards Deming',
    url: null,
    publishedAt: '1982',
    accessedAt: NOW,
    type: 'book',
    credibility: 0.95,
    supports: ['PDCA 在组织质量改进中的系统化应用'],
    publisher: 'MIT Press',
    isbn: null,
    doi: null,
    language: 'en',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'src_okr_google',
    title: 'Rework（对 OKR 与目标管理实践的记录）',
    authorOrOrg: 'John Doerr',
    url: null,
    publishedAt: '2018',
    accessedAt: NOW,
    type: 'book',
    credibility: 0.85,
    supports: ['OKR 的目标设定与关键结果拆解实践'],
    publisher: 'Crown Business',
    isbn: null,
    doi: null,
    language: 'en',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'src_first_principles',
    title: '第一性原理的公开论述（Musk 在访谈与演讲中的反复使用）',
    authorOrOrg: 'Elon Musk（多次公开演讲与访谈）',
    url: null,
    publishedAt: null,
    accessedAt: NOW,
    type: 'speech',
    credibility: 0.7,
    supports: ['第一性原理作为推理方式的公开表述'],
    publisher: null,
    isbn: null,
    doi: null,
    language: 'en',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'src_swot_original',
    title: 'The SWOT Matrix（Andrews 等人的竞争战略框架）',
    authorOrOrg: 'Andrews / Learned / Christensen / Guth 等',
    url: null,
    publishedAt: null,
    accessedAt: NOW,
    type: 'book',
    credibility: 0.85,
    supports: ['SWOT 的四象限结构与竞争分析用途'],
    publisher: null,
    isbn: null,
    doi: null,
    language: 'en',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'src_feynman_technique',
    title: '费曼技巧的公开表述（Simon Sinek 的 TED 演讲等）',
    authorOrOrg: 'Simon Sinek 等',
    url: null,
    publishedAt: null,
    accessedAt: NOW,
    type: 'speech',
    credibility: 0.6,
    supports: ['以教代学、用简明语言解释概念的核心理念'],
    publisher: null,
    isbn: null,
    doi: null,
    language: 'en',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'src_pareto_original',
    title: '原始帕累托分布的统计学表述',
    authorOrOrg: 'Vilfredo Pareto',
    url: null,
    publishedAt: null,
    accessedAt: NOW,
    type: 'paper',
    credibility: 0.8,
    supports: ['少数原因造成多数结果的分布规律'],
    publisher: null,
    isbn: null,
    doi: null,
    language: 'en',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'src_retrospective',
    title: '结构化复盘的公开实践（如 US Navy 的 AAR 框架）',
    authorOrOrg: '美国海军 After Action Review 传统',
    url: null,
    publishedAt: null,
    accessedAt: NOW,
    type: 'report',
    credibility: 0.75,
    supports: ['复盘的基本结构：回顾目标、对比实际、分析差异、形成结论'],
    publisher: null,
    isbn: null,
    doi: null,
    language: 'en',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'src_decision_tree',
    title: '决策树分析方法（决策分析中的标准结构）',
    authorOrOrg: '决策分析领域的通用方法',
    url: null,
    publishedAt: null,
    accessedAt: NOW,
    type: 'book',
    credibility: 0.75,
    supports: ['决策树用分支结构表达选择与结果的关系'],
    publisher: null,
    isbn: null,
    doi: null,
    language: 'en',
    createdAt: NOW,
    updatedAt: NOW,
  },
];

/** 方法论档案 —— 首批 8 个经典方法论 */
const methods: Method[] = [
  {
    id: 'method_pdca',
    name: 'PDCA 循环',
    aliases: ['Plan-Do-Check-Act', '戴明循环', 'PDCA 循环法'],
    domainIds: ['management', 'work_methods'],
    type: 'process',
    origin: {
      proposer: 'Walter A. Shewhart（提出雏形），W. Edwards Deming（在日本推广并命名 PDCA）',
      firstProposedAt: '1930年代（Shewhart 时期）',
      sourceIds: ['src_pdca_original', 'src_deming_out_of_crisis'],
    },
    content: {
      coreIdea:
        '把改进工作拆成「计划—执行—检查—处理」四个阶段闭环循环，通过不断迭代实现持续改进。每轮循环的检查结果直接进入下一轮的计划环节，形成自我修正的机制。',
      principles: [
        '改进是一个循环过程，不是一次性动作',
        '检查环节必须对照事先设定的标准，否则无法判断偏差',
        '处理环节的核心是「标准化」——把有效做法固化，把无效做法转入下一轮',
      ],
      mechanism:
        '闭环结构让「发现问题」和「解决问题」不再是两件割裂的事。检查产生的偏差信息直接成为下一轮计划的输入，因此改进速度取决于循环周期而非单次改进质量。',
      scenarios: [
        '生产制造中的质量改进',
        '项目管理中的持续迭代',
        '个人习惯养成的闭环设计',
        '组织流程的持续优化',
      ],
      conditions: [
        '需要事先明确的标准与目标，否则「检查」环节无法判定偏差',
        '循环周期不能过长，否则反馈延迟会削弱学习效果',
        '「处理」环节要有落地机制，否则改进停留在纸面',
      ],
      steps: [
        'Plan：明确目标与衡量标准，分析现状，识别差距',
        'Do：小范围执行计划，记录执行过程与观察到的数据',
        'Check：将实际结果与标准对比，量化差距',
        'Act：有效做法标准化并推广，无效做法分析原因并转入下一轮 Plan',
      ],
      advantages: [
        '结构简单，容易在各类场景中落地',
        '把改进从「一次性项目」变成可持续的日常机制',
        '检查环节强制量化对比，减少主观判断',
      ],
      disadvantages: [
        '循环周期长时反馈滞后',
        '在高度创新、无法量化的事务上难以设定「标准」',
        '容易被形式主义化，变成填表打卡',
      ],
      limitations: [
        '不适用于没有可测量标准的探索性工作',
        '不适合需要快速试错并立即获得方向反馈的场景',
      ],
      misconceptions: [
        '误以为四个阶段必须严格串行，实际中 Plan 和 Act 常需要反复迭代',
        '误以为走完一轮就结束，PDCA 的价值在于持续循环',
        '误把「处理」理解为「结束项目」，其核心是标准化与推广',
      ],
    },
    evidence: {
      level: 'high',
      claims: [
        {
          id: 'claim_pdca_1',
          category: 'origin',
          statement: 'PDCA 的四阶段结构源自 Shewhart 的统计质量控制循环，Deming 在 1950 年代将其引入日本质量管理并推广。',
          sourceIds: ['src_pdca_original', 'src_deming_out_of_crisis'],
          strength: 0.9,
          notes: null,
        },
        {
          id: 'claim_pdca_2',
          category: 'practice',
          statement: 'PDCA 在日本制造业质量改进中被大规模应用，Deming 的著作记录了这一实践路径。',
          sourceIds: ['src_deming_out_of_crisis'],
          strength: 0.85,
          notes: null,
        },
        {
          id: 'claim_pdca_3',
          category: 'ai_inference',
          statement: '把 PDCA 迁移到个人习惯与知识管理场景属于类比应用，其有效性缺少直接实证支持。',
          sourceIds: [],
          strength: 0.5,
          notes: '这是 AI 基于结构相似性做出的推断，不是原作者观点。',
        },
      ],
      confidence: 0.85,
    },
    relatedIds: ['method_retrospective', 'method_kaizen'],
    caseIds: [],
    tags: ['持续改进', '质量管理', '闭环'],
    status: 'approved',
    article: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    lastResearchedAt: NOW,
    history: [
      {
        version: 1,
        at: NOW,
        summary: '初始种子档案',
        changeType: 'create',
        by: 'system',
      },
    ],
  },
  {
    id: 'method_okr',
    name: 'OKR 目标管理法',
    aliases: ['Objectives and Key Results', '目标与关键结果'],
    domainIds: ['management'],
    type: 'framework',
    origin: {
      proposer: 'Andy Grove（Intel 时期提出），John Doerr（推广并体系化）',
      firstProposedAt: '1970年代（Intel）',
      sourceIds: ['src_okr_google'],
    },
    content: {
      coreIdea:
        '用一个鼓舞人心的定性目标（Objective）指明方向，再用若干可量化的关键结果（Key Results）定义「怎样算达成」。目标负责对齐方向，关键结果负责让进展可见。',
      principles: [
        '目标要定性、有感召力，能让人知道自己为什么做',
        '关键结果必须可量化、可验证',
        '关键结果是「结果的度量」，不是「待办事项清单」',
      ],
      mechanism:
        '把「方向」与「度量」分离，让组织既能对齐意图，又能量化进展。关键结果的公开可见性降低了跨部门协作中的信息不对称。',
      scenarios: [
        '季度目标设定与对齐',
        '创业公司的目标管理',
        '跨部门项目的里程碑拆解',
        '个人年度目标规划',
      ],
      conditions: [
        '组织文化能接受「目标不是承诺」的前提，否则会被当作 KPI',
        '关键结果必须真的可量化，不能用模糊表述',
        '需要定期复盘节奏（如每周或双周检查）',
      ],
      steps: [
        '设定一个鼓舞人心且方向明确的目标',
        '为每个目标定义 2-4 个可量化的关键结果',
        '把目标与关键结果公开对齐到相关团队',
        '定期检查进展，根据实际情况调整关键结果',
        '周期结束后复盘并进入下一轮',
      ],
      advantages: [
        '目标与度量分离，既保留方向感又保证可验证',
        '公开对齐减少信息不对称',
        '天然支持跨团队协作与优先级排序',
      ],
      disadvantages: [
        '容易蜕变为层层分解的 KPI，失去敏捷性',
        '关键结果的量化难度大，容易流于形式',
        '对组织文化要求高，不适合强控制型环境',
      ],
      limitations: [
        '不适用于需要长期稳定路径、难以短期度量的工作',
        '在层级森严、执行力弱的组织中难以发挥作用',
      ],
      misconceptions: [
        '误把 OKR 当作 KPI —— OKR 是方向对齐工具，不是考核工具',
        '误把关键结果写成任务清单 —— 任务写的是「做了什么」，KR 写的是「结果如何」',
        '误以为关键结果不能调整 —— OKR 的价值之一就是允许根据实际调整',
      ],
    },
    evidence: {
      level: 'medium',
      claims: [
        {
          id: 'claim_okr_1',
          category: 'origin',
          statement: 'OKR 由 Andy Grove 在 Intel 时期引入，John Doerr 在书中记录了其演进与推广过程。',
          sourceIds: ['src_okr_google'],
          strength: 0.85,
          notes: null,
        },
        {
          id: 'claim_okr_2',
          category: 'practice',
          statement: 'OKR 被多家科技公司采用为季度目标管理框架。',
          sourceIds: ['src_okr_google'],
          strength: 0.8,
          notes: null,
        },
      ],
      confidence: 0.8,
    },
    relatedIds: ['method_pdca', 'method_swot'],
    caseIds: [],
    tags: ['目标管理', '战略对齐', '量化'],
    status: 'approved',
    article: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    lastResearchedAt: NOW,
    history: [
      {
        version: 1,
        at: NOW,
        summary: '初始种子档案',
        changeType: 'create',
        by: 'system',
      },
    ],
  },
  {
    id: 'method_first_principles',
    name: '第一性原理',
    aliases: ['First Principles', '第一性原理思维'],
    domainIds: ['thinking'],
    type: 'principle',
    origin: {
      proposer: '亚里士多德（概念起源），Elon Musk（现代推广）',
      firstProposedAt: '古希腊时期',
      sourceIds: ['src_first_principles'],
    },
    content: {
      coreIdea:
        '把问题拆解到最基本、不可再分的事实前提上，再从这些前提重新推导结论，而不是从类比和惯例出发。',
      principles: [
        '区分「公理」与「类比假设」——前者是基础，后者是当前做法的理由',
        '推导过程必须从基础事实出发，不能跳步',
        '结论如果与常识冲突，需要检查前提而不是结论',
      ],
      mechanism:
        '类比推理的效率高但受限于既有方案的空间。第一性原理通过拆解前提，理论上能探索到类比无法到达的方案空间，代价是推导成本高得多。',
      scenarios: [
        '产品成本结构的重新拆解',
        '突破行业惯例的方案设计',
        '复杂问题的根因定位',
        '个人决策中的假设检验',
      ],
      conditions: [
        '问题确实存在可拆解的物理或逻辑基础',
        '有足够时间与资源做完整推导',
        '推导者具备相关领域的判断力，否则只是换一种方式出错',
      ],
      steps: [
        '把当前方案拆解成其依赖的假设清单',
        '区分哪些是物理/逻辑上的必然，哪些是行业惯例或他人做法',
        '针对「惯例类」假设问：为什么必须这样？',
        '从保留下来的基础前提重新推导可行方案',
        '对比新方案的成本与收益，评估是否值得替换',
      ],
      advantages: [
        '能突破现有方案的天花板',
        '强制暴露隐藏在惯例背后的假设',
        '结论建立在可验证的前提上',
      ],
      disadvantages: [
        '推导成本高，多数场景性价比不划算',
        '容易被滥用为「否定现状」的修辞',
        '对推导者能力要求高，误用风险大',
      ],
      limitations: [
        '不适用于已有成熟低成本解法的常规问题',
        '需要大量基础数据支撑，缺数据时容易流于空谈',
      ],
      misconceptions: [
        '误以为「第一性原理」等于「从零重新发明」 —— 已有方案往往是有效解，问题只在需要突破时',
        '误以为拆解越细越好 —— 拆解到无法再拆的成本远超收益',
        '误把它当作万能方法论 —— 它的适用场景远小于其流行程度',
      ],
    },
    evidence: {
      level: 'medium',
      claims: [
        {
          id: 'claim_fp_1',
          category: 'origin',
          statement: '「第一性原理」作为哲学概念可追溯到亚里士多德，指最基础的、公理性层面的前提。',
          sourceIds: [],
          strength: 0.7,
          notes: '此处为公认的思想史背景，但未指向具体原始文献。',
        },
        {
          id: 'claim_fp_2',
          category: 'practice',
          statement: 'Elon Musk 在多场合公开使用该表述描述产品成本拆解与材料采购的推理方式。',
          sourceIds: ['src_first_principles'],
          strength: 0.65,
          notes: '访谈与演讲属公开表述，但缺乏学术性效果评估。',
        },
        {
          id: 'claim_fp_3',
          category: 'ai_inference',
          statement: '「第一性原理普遍优于类比推理」这一强主张缺乏充分实证支持，属于流行叙事而非研究共识。',
          sourceIds: [],
          strength: 0.6,
          notes: '这是 AI 的独立判断，供用户参考。',
        },
      ],
      confidence: 0.7,
    },
    relatedIds: ['method_system_thinking', 'method_decision_tree'],
    caseIds: [],
    tags: ['推理方式', '拆解', '突破'],
    status: 'approved',
    article: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    lastResearchedAt: NOW,
    history: [
      {
        version: 1,
        at: NOW,
        summary: '初始种子档案',
        changeType: 'create',
        by: 'system',
      },
    ],
  },
  {
    id: 'method_swot',
    name: 'SWOT 分析',
    aliases: ['Strengths Weaknesses Opportunities Threats', '四象限分析法'],
    domainIds: ['thinking', 'business'],
    type: 'framework',
    origin: {
      proposer: 'Albert Humphrey / Learned / Andrews 等（20世纪60年代前后）',
      firstProposedAt: '1960年代',
      sourceIds: ['src_swot_original'],
    },
    content: {
      coreIdea:
        '从内部优势、内部劣势、外部机会、外部威胁四个维度描述现状，形成一张结构化的战略分析表。',
      principles: [
        '内部因素（优势/劣势）与外部因素（机会/威胁）必须区分清楚',
        '四个象限是描述工具，不是评价工具——本身不含好坏判断',
        '分析的价值在交叉推演，不在罗列清单',
      ],
      mechanism:
        '强制把内外因素分开，避免「内部原因归内部、外部原因归外部」的归因偏差。四象限的结构化让跨维度组合成为可能。',
      scenarios: [
        '企业战略分析',
        '个人职业选择',
        '产品市场进入评估',
        '项目立项前的环境扫描',
      ],
      conditions: [
        '分析者对对象有足够了解，能给出具体而非泛泛的条目',
        '四个象限的条目需要相互关联，孤立罗列无意义',
        '外部因素需要有外部信息支撑，不能纯靠想象',
      ],
      steps: [
        '列出当前的内部优势（可控的、已具备的）',
        '列出内部劣势（可控的、缺失的）',
        '列出外部机会（不可控的、有利的趋势）',
        '列出外部威胁（不可控的、不利的趋势）',
        '交叉推演：SO 策略、WO 策略、ST 策略、WT 策略',
      ],
      advantages: [
        '结构简单，沟通成本低',
        '强制区分内外因素，减少归因偏差',
        '便于跨部门横向讨论',
      ],
      disadvantages: [
        '容易流于表面，产出泛泛的四张清单',
        '缺乏内在逻辑，条目之间可能互相矛盾',
        '对分析者的领域经验依赖很高',
      ],
      limitations: [
        '不适合需要精确量化与预测的决策',
        '不适合快速变化的动态环境（快照式分析）',
      ],
      misconceptions: [
        '误把 SWOT 当成「一次分析做完」—— 它是需要持续更新的动态框架',
        '误把四个象限当成评价标准 —— 优势不等于该做的，劣势不一定该改',
        '误以为做完四象限就完成分析 —— 真正的价值在交叉推演',
      ],
    },
    evidence: {
      level: 'medium',
      claims: [
        {
          id: 'claim_swot_1',
          category: 'origin',
          statement: 'SWOT 于 1960 年代由斯坦福研究院相关学者在竞争战略研究中形成，后被 Andrews 等人纳入战略规划框架。',
          sourceIds: ['src_swot_original'],
          strength: 0.8,
          notes: null,
        },
      ],
      confidence: 0.75,
    },
    relatedIds: ['method_okr', 'method_decision_tree'],
    caseIds: [],
    tags: ['战略分析', '环境扫描'],
    status: 'approved',
    article: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    lastResearchedAt: NOW,
    history: [
      {
        version: 1,
        at: NOW,
        summary: '初始种子档案',
        changeType: 'create',
        by: 'system',
      },
    ],
  },
  {
    id: 'method_retrospective',
    name: '结构化复盘',
    aliases: ['复盘方法', 'After Action Review', 'AAR', '回顾分析'],
    domainIds: ['work_methods', 'personal_growth'],
    type: 'process',
    origin: {
      proposer: '美国军队 After Action Review 传统，后被企业界广泛借用',
      firstProposedAt: '20世纪',
      sourceIds: ['src_retrospective'],
    },
    content: {
      coreIdea:
        '在事件结束后系统回顾：原本预期发生什么、实际发生了什么、差异出在哪里、下次怎么改。核心不是追责，而是提取可复用的学习。',
      principles: [
        '复盘的目的是学习，不是评判当事人',
        '先还原事实，再分析原因，最后形成行动项',
        '差异分析要区分「决策当时的信息条件」和「事后的信息条件」',
      ],
      mechanism:
        '结构化的追问顺序把「叙述」变成「分析」，避免会议变成故事分享。强制对照预期与实际，让隐性偏差暴露出来。',
      scenarios: [
        '项目结束后的经验总结',
        '故障与失误的分析',
        '个人月度与季度回顾',
        '团队协作模式的改进',
      ],
      conditions: [
        '需要事先记录预期目标，否则无法对比',
        '参与者的心理安全度足够，否则不敢讲真实情况',
        '必须有行动项，否则复盘变成情绪宣泄',
      ],
      steps: [
        '回顾原定目标：当时想达成什么，标准是什么',
        '陈述实际结果：客观发生了什么，用事实而非评价',
        '分析差异：哪些因素促成了偏差，哪些被忽略',
        '提炼结论：哪些做法有效应保留，哪些应调整',
        '形成行动项：具体、可执行、有责任人和时间',
      ],
      advantages: [
        '把经验转化为可复用的组织记忆',
        '强制区分事实与判断，减少归因偏差',
        '产出明确行动项而非泛泛感想',
      ],
      disadvantages: [
        '耗时，且需要提前记录才有效',
        '容易滑向追责文化，一旦如此就会失真',
        '对没有预期基线的场景难以开展',
      ],
      limitations: [
        '不适合尚未结束、仍在演进的事项',
        '不适合需要实时调整的场景',
      ],
      misconceptions: [
        '误以为复盘是批评会 —— 追责会让信息失真，复盘就失效了',
        '误以为复盘就是聊天回顾 —— 没有对照预期与实际就没有分析',
        '误以为一次复盘能解决所有问题 —— 需要持续执行才能形成改进',
      ],
    },
    evidence: {
      level: 'medium',
      claims: [
        {
          id: 'claim_retro_1',
          category: 'origin',
          statement: '结构化复盘的基本框架源自美国海军的 After Action Review 实践，包含目标对照、差异分析与结论三个环节。',
          sourceIds: ['src_retrospective'],
          strength: 0.8,
          notes: null,
        },
      ],
      confidence: 0.75,
    },
    relatedIds: ['method_pdca', 'method_feynman'],
    caseIds: [],
    tags: ['经验总结', '改进', '反思'],
    status: 'approved',
    article: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    lastResearchedAt: NOW,
    history: [
      {
        version: 1,
        at: NOW,
        summary: '初始种子档案',
        changeType: 'create',
        by: 'system',
      },
    ],
  },
  {
    id: 'method_feynman',
    name: '费曼学习法',
    aliases: ['Feynman Technique', '以教代学', '费曼技巧'],
    domainIds: ['learning'],
    type: 'process',
    origin: {
      proposer: ' popularly attributed to Richard Feynman（确切出处存疑）',
      firstProposedAt: null,
      sourceIds: ['src_feynman_technique'],
    },
    content: {
      coreIdea:
        '假装向一个外行讲解你正在学的东西，用最朴素的语言讲清楚。讲不下去的地方，就是你还没真懂的地方。',
      principles: [
        '用自己的话重述，不能照抄定义',
        '面向「完全不懂的人」讲，禁止使用行话',
        '卡壳处即为知识盲区，需要回到原始材料补齐',
        '讲完后回头简化，去掉所有多余修饰',
      ],
      mechanism:
        '提取练习（主动回忆）本身就能检验理解程度；面向外行的表达约束进一步暴露了「知道答案但说不清」的伪理解。两者叠加使学习效果可自我验证。',
      scenarios: [
        '学习新概念的自检',
        '准备面试或授课',
        '技术文档的通俗化写作',
        '长期知识体系的巩固',
      ],
      conditions: [
        '需要选择合适的主题粒度 —— 太大讲不透，太小无意义',
        '需要容忍最初的「讲不出来」，这是方法的正常阶段',
        '需要回到原始资料核对，卡壳不能靠猜',
      ],
      steps: [
        '选定要掌握的概念，写在纸的顶端',
        '假装向完全不懂的人讲解，用最朴素的语言',
        '卡住的地方做标记',
        '回到原始资料补齐标记处，重新理解',
        '简化语言后再次完整讲解',
      ],
      advantages: [
        '自检效率高，能快速定位知识盲区',
        '强制建立知识之间的联系',
        '产出可直接用于教学或沟通的内容',
      ],
      disadvantages: [
        '对「什么是学会了」的判定带有主观性',
        '初期体验挫败，容易让人误以为自己不适合学',
        '耗时高于被动阅读',
      ],
      limitations: [
        '不适合作为首次接触大量新知识的唯一方法',
        '不适合纯技能型、需身体练习的内容',
      ],
      misconceptions: [
        '误以为「能讲出来」就等于完全掌握 —— 讲解深度和准确性仍需检验',
        '误把它当成快速记忆技巧 —— 它是理解检验工具，不是记忆方法',
        '误以为必须讲给别人听 —— 讲给自己或写在纸上同样有效',
      ],
    },
    evidence: {
      level: 'low',
      claims: [
        {
          id: 'claim_feynman_1',
          category: 'practice',
          statement: '「费曼技巧」这一名称与理查德·费曼的关联在公开资料中存在争议，无法确认其本人提出过该方法。',
          sourceIds: ['src_feynman_technique'],
          strength: 0.5,
          notes: '这属于对该方法提出者归属的明确保留意见。',
        },
        {
          id: 'claim_feynman_2',
          category: 'research',
          statement: '「提取练习」与「自我解释」在学习科学中有较多研究支持，被认为有助于长期记忆与理解。',
          sourceIds: [],
          strength: 0.7,
          notes: '机制层面有支持，但与「费曼学习法」这一具体命名不能等同。',
        },
      ],
      confidence: 0.6,
    },
    relatedIds: ['method_retrospective', 'method_spaced_repetition'],
    caseIds: [],
    tags: ['学习方法', '输出', '自检'],
    status: 'approved',
    article: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    lastResearchedAt: NOW,
    history: [
      {
        version: 1,
        at: NOW,
        summary: '初始种子档案',
        changeType: 'create',
        by: 'system',
      },
    ],
  },
  {
    id: 'method_pareto',
    name: '二八法则',
    aliases: ['Pareto Principle', '80/20 法则', '帕累托法则'],
    domainIds: ['thinking', 'work_methods'],
    type: 'principle',
    origin: {
      proposer: 'Vilfredo Pareto',
      firstProposedAt: '19世纪末（1896年）',
      sourceIds: ['src_pareto_original'],
    },
    content: {
      coreIdea:
        '在许多分布中，约 80% 的结果来自 20% 的原因。识别出这关键的少数，把资源集中到那里。',
      principles: [
        '少数原因造成多数结果是常见分布特征，不是普遍定律',
        '必须先做分类统计才能找出那 20%',
        '不同领域的具体比例不同，不能机械套用 80/20',
      ],
      mechanism:
        '资源分配的机会成本很高时，把注意力集中到高产出部分能获得最大边际收益。前提是分布确实不均匀。',
      scenarios: [
        '客户贡献度分析',
        '个人时间与精力分配',
        '缺陷根因排查',
        '产品功能使用频次分析',
      ],
      conditions: [
        '分布必须近似幂律，均匀分布时法则无意义',
        '必须基于实际数据统计，不能凭感觉判断',
        '「关键少数」会随时间变化，需要定期重算',
      ],
      steps: [
        '对现象进行分类统计，得出各项的数量或贡献',
        '按贡献从大到小排序',
        '计算累计占比，找出贡献前 20% 的项目',
        '把主要资源投向这部分，同时保留对长尾的基本覆盖',
      ],
      advantages: [
        '在资源有限时提供明确的优先级依据',
        '统计方法简单，容易执行',
        '引导关注被忽略的高价值少数',
      ],
      disadvantages: [
        '80/20 的具体比例是经验值，不同领域差异很大',
        '容易被当作忽略长尾的理由',
        '分类方式不同会得到不同结论',
      ],
      limitations: [
        '不适用于分布均匀的领域',
        '不适合所有项目价值必须被保障的场景',
      ],
      misconceptions: [
        '误以为任何场景都是 80/20 —— 比例本身是经验描述',
        '误以为可以完全忽略长尾 —— 长尾的忽视成本可能很高',
        '误把「二八」当成精确目标 —— 它是分配策略的启发式',
      ],
    },
    evidence: {
      level: 'high',
      claims: [
        {
          id: 'claim_pareto_1',
          category: 'origin',
          statement: '帕累托在 1896 年观察到意大利土地所有权分布中少数人口占有多数土地，随后提出分布规律。',
          sourceIds: ['src_pareto_original'],
          strength: 0.9,
          notes: null,
        },
        {
          id: 'claim_pareto_2',
          category: 'research',
          statement: '幂律分布在诸多领域被观测到，但并非所有分布都符合二八结构。',
          sourceIds: [],
          strength: 0.7,
          notes: null,
        },
      ],
      confidence: 0.85,
    },
    relatedIds: ['method_decision_tree', 'method_system_thinking'],
    caseIds: [],
    tags: ['优先级', '资源分配', '分布'],
    status: 'approved',
    article: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    lastResearchedAt: NOW,
    history: [
      {
        version: 1,
        at: NOW,
        summary: '初始种子档案',
        changeType: 'create',
        by: 'system',
      },
    ],
  },
  {
    id: 'method_decision_tree',
    name: '决策树',
    aliases: ['Decision Tree', '决策树分析'],
    domainIds: ['thinking', 'communication'],
    type: 'tool',
    origin: {
      proposer: '决策分析领域的标准方法（具体提出者待考）',
      firstProposedAt: null,
      sourceIds: ['src_decision_tree'],
    },
    content: {
      coreIdea:
        '用树状结构表达决策：每个节点是一个选择或机会事件，分支是可能的结果，叶节点是最终结局。结构化之后，选择的逻辑和风险点都变得可见。',
      principles: [
        '节点必须是决策点或机会事件，不能混杂',
        '分支必须穷尽所有可能，不留隐含选项',
        '末端叶节点必须对应可比较的结果',
      ],
      mechanism:
        '图形化把「我到底在选什么」显性化。分支的穷尽性要求迫使决策者意识到被忽略的选项，末端统一的结果维度让不同路径可直接比较。',
      scenarios: [
        '职业路径选择',
        '技术方案选型',
        '投资决策分析',
        '风险识别与预案设计',
      ],
      conditions: [
        '决策点数量不能太多，否则树会失控',
        '分支概率或收益需要有一定依据',
        '适合单一决策者、单一目标的决策',
      ],
      steps: [
        '明确最终要决定什么（根节点）',
        '列出该决策下的主要选项（第一层分支）',
        '对每个选项展开后续可能情况',
        '为末端标注结果与代价',
        '比较各路径，用数据或判断收敛到决策',
      ],
      advantages: [
        '把决策逻辑可视化，沟通效率高',
        '穷尽性要求能暴露被忽略的选项',
        '便于识别风险点与关键决策节点',
      ],
      disadvantages: [
        '分支爆炸时难以维护',
        '概率难以准确估计时容易产生虚假精确',
        '不适合多目标同时权衡的决策',
      ],
      limitations: [
        '不适合选项持续新增的开放性决策',
        '不适合需要实时调整的动态环境',
      ],
      misconceptions: [
        '误以为画完树就等于做完了决策 —— 还需比较与收敛',
        '误把概率当成客观事实 —— 多数情况下的概率是主观估计',
        '误以为树能穷尽所有风险 —— 存在完全未知的风险',
      ],
    },
    evidence: {
      level: 'medium',
      claims: [
        {
          id: 'claim_dt_1',
          category: 'research',
          statement: '决策树是决策分析与不确定性建模中的标准工具，结构化表达选择与结果的对应关系。',
          sourceIds: ['src_decision_tree'],
          strength: 0.8,
          notes: null,
        },
      ],
      confidence: 0.75,
    },
    relatedIds: ['method_first_principles', 'method_swot', 'method_pareto'],
    caseIds: [],
    tags: ['决策', '结构化', '可视化'],
    status: 'approved',
    article: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    lastResearchedAt: NOW,
    history: [
      {
        version: 1,
        at: NOW,
        summary: '初始种子档案',
        changeType: 'create',
        by: 'system',
      },
    ],
  },
];

/** 知识关联 */
const relations: Relation[] = [
  {
    id: 'rel_pdca_retro',
    fromId: 'method_pdca',
    toId: 'method_retrospective',
    type: 'complementary',
    explanation:
      'PDCA 的「检查」环节提供偏差数据，结构化复盘提供差异分析的方法论，两者配合构成完整的改进回路。',
    evidenceRefs: [],
    confidence: 0.85,
    origin: 'ai',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'rel_pdca_okr',
    fromId: 'method_pdca',
    toId: 'method_okr',
    type: 'complementary',
    explanation:
      'OKR 提供目标与度量标准，PDCA 提供达成目标的迭代机制，前者解决「往哪走」，后者解决「怎么持续改进」。',
    evidenceRefs: [],
    confidence: 0.8,
    origin: 'ai',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'rel_fp_system',
    fromId: 'method_first_principles',
    toId: 'method_system_thinking',
    type: 'similar',
    explanation:
      '两者都强调回到基础结构理解问题，第一性原理关注不可再分的公理，系统思维关注要素间的反馈关系。',
    evidenceRefs: [],
    confidence: 0.75,
    origin: 'ai',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'rel_fp_dt',
    fromId: 'method_first_principles',
    toId: 'method_decision_tree',
    type: 'application',
    explanation:
      '第一性原理可用于拆解决策树中的假设前提，判断某个分支是否建立在真实约束上。',
    evidenceRefs: [],
    confidence: 0.7,
    origin: 'ai',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'rel_swot_okr',
    fromId: 'method_swot',
    toId: 'method_okr',
    type: 'application',
    explanation:
      'SWOT 分析得到的外部机会与内部优势可转化为 OKR 的目标来源，形成「分析—定目标」的衔接。',
    evidenceRefs: [],
    confidence: 0.7,
    origin: 'ai',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'rel_feynman_retro',
    fromId: 'method_feynman',
    toId: 'method_retrospective',
    type: 'complementary',
    explanation:
      '费曼学习法是知识输入端的理解检验，复盘是输出端的经验提取，两者共同构成学习闭环。',
    evidenceRefs: [],
    confidence: 0.8,
    origin: 'ai',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'rel_pareto_dt',
    fromId: 'method_pareto',
    toId: 'method_decision_tree',
    type: 'application',
    explanation:
      '在决策树的末端结果中识别高贡献分支，可把资源集中到影响最大的路径上。',
    evidenceRefs: [],
    confidence: 0.7,
    origin: 'ai',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'rel_swot_dt',
    fromId: 'method_swot',
    toId: 'method_decision_tree',
    type: 'complementary',
    explanation:
      'SWOT 提供环境扫描的维度，决策树提供选择的结构，两者结合可把定性分析接入定量决策。',
    evidenceRefs: [],
    confidence: 0.65,
    origin: 'ai',
    createdAt: NOW,
    updatedAt: NOW,
  },
];

async function main(): Promise<void> {
  if (!TOKEN) {
    console.error('缺少 GITHUB_TOKEN_DATA，无法写入数据仓');
    process.exit(1);
  }

  const client = new GitHubClient({ owner: OWNER, repo: REPO, token: TOKEN, branch: BRANCH });
  const repo = new DataRepo({ client });

  console.log(`写入 ${domains.length} 个领域…`);
  await repo.setCollection('data/domains.json', { domains });

  console.log(`写入 ${sources.length} 条来源…`);
  await repo.setCollection('data/sources.json', { sources });

  console.log(`写入 ${methods.length} 个方法论档案…`);
  for (const m of methods) {
    await repo.saveMethod(m);
  }

  console.log(`写入 ${relations.length} 条关联…`);
  await repo.setCollection('data/relations.json', { relations });

  console.log('写入空的集合文件…');
  await repo.setCollection('data/cases.json', { cases: [] as CaseStudy[] });
  await repo.setCollection('data/practices.json', { practices: [] });
  await repo.setCollection('data/learning.json', {
    plans: [],
    tasks: [],
    quizzes: [],
    mastery: [],
  });
  await repo.setCollection('data/reviews.json', { reviews: [] });
  await repo.setCollection('research/queue.json', { tasks: [], candidates: [] });

  console.log('\n种子数据写入完成。');
  console.log('下一步：npm run data:index 构建检索索引。');
}

main().catch((err: unknown) => {
  console.error('种子数据写入失败：', err instanceof Error ? err.message : err);
  process.exit(1);
});
