import './homeMenu.scss';

type HomeMenuProps = {
  onStart: () => void;
  onOpenAchievements: () => void;
  onOpenSettings: () => void;
};

type JourneyModeSelectProps = {
  onSelectSingle: () => void;
  onSelectTeam: () => void;
  onBack: () => void;
};

const menuItems = [
  {
    label: '开始游戏',
    asset: '/home/extracted/button-start-new.png',
    tone: 'primary',
    action: 'start',
  },
  {
    label: '继续旅程',
    asset: '/home/extracted/button-continue-new.png',
    tone: 'paper',
    action: 'continue',
  },
  {
    label: '设置选项',
    asset: '/home/extracted/button-settings-new.png',
    tone: 'paper',
    action: 'settings',
  },
  {
    label: '成就图鉴',
    asset: '/home/extracted/button-achievements-new.png',
    tone: 'paper',
    action: 'achievements',
  },
] as const;

export function HomeMenu({ onStart, onOpenAchievements, onOpenSettings }: HomeMenuProps) {
  function handleMenuAction(action: (typeof menuItems)[number]['action']) {
    if (action === 'settings') {
      onOpenSettings();
      return;
    }

    if (action === 'achievements') {
      onOpenAchievements();
      return;
    }

    onStart();
  }

  return (
    <section className="home-menu" aria-label="游戏首页">
      <div className="home-menu__background" aria-hidden="true" />
      <div className="home-menu__atmosphere" aria-hidden="true" />

      <div className="home-menu__content">
        <header className="home-menu__brand" aria-label="首页标题区">
          <img
            className="home-menu__wordmark"
            src="/home/extracted/title-wordmark-image2.png"
            alt="江水绿洲，沙海中的希望与家园"
          />
        </header>

        <nav className="home-menu__panel" aria-label="首页主菜单">
          {menuItems.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`home-menu__action home-menu__action--${item.tone}`}
              aria-label={item.label}
              onClick={() => {
                handleMenuAction(item.action);
              }}
            >
              <img className="home-menu__action-art" src={item.asset} alt="" aria-hidden="true" />
            </button>
          ))}
        </nav>
      </div>
    </section>
  );
}

export function JourneyModeSelect({ onSelectSingle, onSelectTeam, onBack }: JourneyModeSelectProps) {
  return (
    <section className="journey-mode-select" aria-label="选择旅程方式">
      <div
        className="journey-mode-select__background"
        data-asset="/home/mode-select/image2-assets/background-clean.png"
        aria-hidden="true"
      />

      <div className="journey-mode-select__panel">
        <img
          className="journey-mode-select__title"
          src="/home/mode-select/exact-split/assets/title-select-journey.png"
          alt="选择旅程方式"
        />
        <button
          type="button"
          className="journey-mode-select__choice journey-mode-select__choice--single"
          aria-label="单人模式"
          onClick={onSelectSingle}
        >
          <img src="/home/mode-select/exact-split/assets/button-single-active.png" alt="" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="journey-mode-select__choice journey-mode-select__choice--team"
          aria-label="组队模式"
          onClick={onSelectTeam}
        >
          <img src="/home/mode-select/exact-split/assets/button-team-idle.png" alt="" aria-hidden="true" />
        </button>
        <img
          className="journey-mode-select__hint"
          src="/home/mode-select/exact-split/assets/hint-enter-main.png"
          alt=""
          aria-hidden="true"
        />
        <img
          className="journey-mode-select__divider"
          src="/home/mode-select/exact-split/assets/divider-long.png"
          alt=""
          aria-hidden="true"
        />
        <button type="button" className="journey-mode-select__back" aria-label="返回首页" onClick={onBack}>
          <img src="/home/mode-select/exact-split/assets/button-back-text.png" alt="" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
