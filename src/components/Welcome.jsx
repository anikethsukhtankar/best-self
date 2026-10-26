import { useTheme } from '../hooks/useTheme';
import { PenroseFigure } from './PenroseFigure';

// The first visit on a device: begin, or look around a sample year first. Nothing is stored
// until Begin.
export function Welcome({ onBegin, onSample }) {
  const { theme, S } = useTheme();
  return (
    <div style={{ ...S.authContainer, padding: 24 }}>
      <div className="fade-in" style={{ maxWidth: 420, width: '100%' }}>
        <PenroseFigure completed={12} total={12} complete width={88} color={theme.accent} />
        <h1 style={{ fontSize: 'clamp(48px, 12vw, 72px)', fontWeight: 100, lineHeight: 1, letterSpacing: '-0.01em', color: theme.text, margin: '40px 0 20px' }}>
          Best Self
        </h1>
        <p style={{ fontSize: 19, fontWeight: 300, lineHeight: 1.5, color: theme.text, margin: '0 0 12px' }}>
          A quiet place for habits that grow.
        </p>
        <p style={{ fontSize: 15, fontWeight: 300, lineHeight: 1.6, color: theme.textSecondary, margin: '0 0 40px' }}>
          Check each habit off as the day goes. When one has held, it is offered its next step,
          and the days you keep are built into a record you can turn in your hands.
        </p>
        <button style={{ ...S.modalButton, marginTop: 0 }} onClick={onBegin}>Begin</button>
        <button style={{ ...S.archiveButton, color: theme.text, fontSize: 15, marginTop: 12 }} onClick={onSample}>
          Look around a sample year first
        </button>
        <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 32, textAlign: 'center' }}>Everything stays on this device.</p>
      </div>
    </div>
  );
}
