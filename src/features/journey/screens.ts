import { getPrimaryAction } from '../app-shell/getPrimaryAction';
import type { JourneyScreen } from './getNextScreen';

export type JourneyScreenConfig = {
  eyebrow: string;
  title: string;
  description: string;
  primaryLabel: string;
  secondaryLabel?: string;
  progress: string;
  note: string;
  statusTag: string;
};

export const JOURNEY_ORDER: JourneyScreen[] = [
  'entry',
  'guiding',
  'approaching',
  'resonance',
  'completion',
  'handoff',
  'finale',
];

export const JOURNEY_SCREENS: Record<JourneyScreen, JourneyScreenConfig> = {
  entry: {
    eyebrow: '橘子洲文旅主线',
    title: '湘江寻乐',
    description: '跟随一段旧日旋律，离开喧闹，走入湘江深处。',
    primaryLabel: getPrimaryAction('start'),
    secondaryLabel: '查看流程',
    progress: '序章已开启',
    note: '入口阶段会先请求定位、相机与声音能力。',
    statusTag: '启序',
  },
  guiding: {
    eyebrow: '聆音进行中',
    title: '洲上循音',
    description: '江风已替你应答，下一段回响正在前方显形。',
    primaryLabel: '前往下一处',
    secondaryLabel: '开启 AR 引导',
    progress: '第 1 / 4 段',
    note: '当前状态以音乐与粒子方向引导玩家离开核心区。',
    statusTag: '导流中',
  },
  approaching: {
    eyebrow: '接近关键节点',
    title: '洲影初醒',
    description: '你已听见此地的回声，再停一瞬，让它向你汇聚。',
    primaryLabel: '准备共鸣',
    secondaryLabel: '查看节点说明',
    progress: '节点确认中',
    note: '这里从找路切换为到点确认，适合展示粒子汇聚效果。',
    statusTag: '接近中',
  },
  resonance: {
    eyebrow: '共鸣动作',
    title: '与此地共鸣',
    description: '长按片刻，让旧日余韵慢慢回应你，完成这一段灵韵唤醒。',
    primaryLabel: '完成共鸣',
    secondaryLabel: '查看蓄力说明',
    progress: '共鸣蓄力',
    note: '正式原型可在这里加入长按动画与音效增强。',
    statusTag: '仪式中',
  },
  completion: {
    eyebrow: '节点完成',
    title: '此地回应了你',
    description: '你获得了江洲灵韵 x1，并解锁了湘音残章的第一段线索。',
    primaryLabel: '进入镇澜',
    secondaryLabel: '继续主线',
    progress: '奖励已发放',
    note: '这里要先给清楚反馈，再允许切进小游戏或继续主线。',
    statusTag: '已完成',
  },
  handoff: {
    eyebrow: '小游戏衔接',
    title: '镇澜',
    description: '江声未止，水意已动。此处旧礼仍在等待你的回应。',
    primaryLabel: '前往终章示意',
    secondaryLabel: '稍后再来',
    progress: '外部玩法占位',
    note: '低保真阶段这里作为小游戏入口说明页即可。',
    statusTag: '已解锁',
  },
  finale: {
    eyebrow: '终章留痕',
    title: '湘江已记住你的回应',
    description: '这一程旋律已归于洲心，而你的回声，将继续留在湘江之上。',
    primaryLabel: '重新开始演示',
    secondaryLabel: '生成纪念海报',
    progress: '旅程已留痕',
    note: '终章需要同时承接纪念内容与后续权益入口。',
    statusTag: '终章',
  },
};
