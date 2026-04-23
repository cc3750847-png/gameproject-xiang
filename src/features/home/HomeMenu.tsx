import './homeMenu.scss';

type HomeMenuProps = {
  onStart: () => void;
  onOpenAchievements: () => void;
  onOpenSettings: () => void;
  onExit: () => void;
};

export function HomeMenu({ onStart, onOpenAchievements, onOpenSettings, onExit }: HomeMenuProps) {
  return (
    <section className="home-menu" aria-label="游戏首页">
      <div className="home-menu__background" aria-hidden="true" />
      <div className="home-menu__wash" aria-hidden="true" />

      <div className="home-menu__content">
        <header className="home-menu__hero">
          <div className="home-menu__title-block" aria-label="首页标题预留区">
            <p className="home-menu__eyebrow">Xiang River Journey</p>
            <div className="home-menu__title-slot">
              <span className="home-menu__title-placeholder">游戏标题预留</span>
              <span className="home-menu__subtitle-placeholder">副标题 / 题字 / 署名位置</span>
            </div>
            <img className="home-menu__divider" src="/home/divider.png" alt="" />
          </div>
        </header>

        <aside className="home-menu__panel home-menu__panel--compact" aria-label="首页主菜单">
          <div className="home-menu__actions">
            <button type="button" className="home-menu__action home-menu__action--primary" onClick={onStart} aria-label="开始游戏">
              <img src="/home/button-start.png" alt="" />
            </button>

            <button type="button" className="home-menu__action" onClick={onOpenAchievements} aria-label="成就图鉴">
              <img src="/home/button-achievement.png" alt="" />
            </button>

            <button type="button" className="home-menu__action" onClick={onOpenSettings} aria-label="设置选项">
              <img src="/home/button-settings.png" alt="" />
            </button>

            <button type="button" className="home-menu__action" onClick={onExit} aria-label="退出游戏">
              <img src="/home/button-exit.png" alt="" />
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}
