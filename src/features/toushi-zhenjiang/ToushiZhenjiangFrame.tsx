type ToushiZhenjiangFrameProps = {
  onClose: () => void;
  closeLabel: string;
};

export function ToushiZhenjiangFrame({ onClose, closeLabel }: ToushiZhenjiangFrameProps) {
  return (
    <main className="toushi-shell" aria-label="投石镇江小游戏">
      <iframe
        className="toushi-shell__frame"
        title="投石镇江"
        src="/toushi-zhenjiang/index.html"
        allow="camera; microphone; accelerometer; gyroscope; fullscreen"
      />
      <button type="button" className="toushi-shell__back" onClick={onClose}>
        {closeLabel}
      </button>
    </main>
  );
}
