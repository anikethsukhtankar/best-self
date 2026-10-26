import { useTheme } from '../hooks/useTheme';
import { heldFor } from '../utils/growth';

// The one quiet offer on Today, and only once the day is done: a habit that has held is offered
// its next step. Digits stay in the tooltip. Once set, the line says what tomorrow brings.
export function NextStep({ offer, pending, onBegin, onNotYet, compact }) {
  const { theme, S } = useTheme();
  if (!offer && !pending) return null;
  const wrap = { marginTop: compact ? 8 : 16, marginBottom: compact ? 32 : 48, paddingTop: 24, borderTop: `1px solid ${theme.border}` };
  const sentence = { fontSize: compact ? 15 : 16, fontWeight: 300, lineHeight: 1.6, color: theme.text, margin: '0 0 16px', maxWidth: 520 };
  const link = { border: 'none', background: 'none', padding: '6px 0', fontFamily: 'inherit', fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer' };

  if (!offer) {
    return (
      <div className="fade-in" style={wrap}>
        <div style={S.sectionLabel}>Next step</div>
        <p style={{ ...sentence, color: theme.textSecondary, margin: 0 }}>Set. Tomorrow, <span style={{ color: theme.text }}>{pending.text}</span>.</p>
      </div>
    );
  }

  const { habit, offer: o } = offer;
  const now = habit.text === o.proposal.text ? null : o.proposal.text;
  return (
    <div className="fade-in late" style={wrap}>
      <div style={S.sectionLabel}>Next step</div>
      <p style={sentence} title={`Done ${o.evidence.done} of the last ${o.evidence.of} times`}>
        <span style={{ fontWeight: 400 }}>{habit.text}</span> has held for {heldFor(o.evidence.sinceDays)}.
        {now ? <> Next: {now}.</> : ' Ready for a next step.'}
      </p>
      <div style={{ display: 'flex', gap: 32 }}>
        <button style={{ ...link, color: theme.text, textDecoration: 'underline', textUnderlineOffset: 5 }} onClick={() => onBegin(habit.id, o.proposal)}>Begin tomorrow</button>
        <button style={{ ...link, color: theme.textMuted }} onClick={() => onNotYet(habit.id)}>Not yet</button>
      </div>
    </div>
  );
}
