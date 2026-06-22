// 资源清单 - 卡牌/英雄图片路径映射
// 独立于渲染逻辑，便于后续做资源预加载、CDN 切换、懒加载配置

/** 卡牌图片路径映射 (defId → 图片相对路径) */
export const MINION_IMAGES: Record<string, string> = {
  // 人族
  human_archer: '/images/minions/human_archer.png',
  human_guard: '/images/minions/human_guard.png',
  human_swordsman: '/images/minions/human_swordsman.png',
  human_monk: '/images/minions/human_monk.png',
  human_general: '/images/minions/human_general.png',
  human_strategist: '/images/minions/human_strategist.png',
  human_immortal: '/images/minions/human_immortal.png',
  human_baima: '/images/minions/human_baima.png',
  human_huben: '/images/minions/human_huben.png',
  human_guanyu: '/images/minions/human_guanyu.png',
  // 妖族
  demon_imp: '/images/minions/demon_imp.png',
  demon_snake: '/images/minions/demon_snake.png',
  demon_bear: '/images/minions/demon_bear.png',
  demon_spider: '/images/minions/demon_spider.png',
  demon_fox: '/images/minions/demon_fox.png',
  demon_bull: '/images/minions/demon_bull.png',
  demon_zombie: '/images/minions/demon_zombie.png',
  demon_goblin: '/images/minions/demon_goblin.png',
  demon_centipede: '/images/minions/demon_centipede.png',
  demon_huangfeng: '/images/minions/demon_huangfeng.png',
  demon_niutou: '/images/minions/demon_niutou.png',
  // 仙族
  spirit_child: '/images/minions/spirit_child.png',
  spirit_crane: '/images/minions/spirit_crane.png',
  spirit_thunder: '/images/minions/spirit_thunder.png',
  spirit_erlang: '/images/minions/spirit_erlang.png',
  spirit_nezha: '/images/minions/spirit_nezha.png',
  spirit_taishang: '/images/minions/spirit_taishang.png',
  spirit_phoenix: '/images/minions/spirit_phoenix.png',
  spirit_yutu: '/images/minions/spirit_yutu.png',
  spirit_lotus: '/images/minions/spirit_lotus.png',
  spirit_nanji: '/images/minions/spirit_nanji.png',
  // 召唤物（衍生物）
  summon_小蛇: '/images/minions/summon_snake.png',
  summon_蛛仔: '/images/minions/summon_spider.png',
  summon_腐尸: '/images/minions/summon_zombie.png',
  summon_蛮牛: '/images/minions/summon_bull.png',
}

/** 英雄头像映射 */
export const HERO_IMAGES: Record<string, string> = {
  hero_xuanwu: '/images/heroes/hero_xuanwu.png',
  hero_zhuque: '/images/heroes/hero_zhuque.png',
  hero_baihu: '/images/heroes/hero_baihu.png',
  hero_qinglong: '/images/heroes/hero_qinglong.png',
  hero_qilin: '/images/heroes/hero_qilin.png',
}
