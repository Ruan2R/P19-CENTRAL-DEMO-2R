import { ArrowRight, BookOpenCheck, CheckCircle2, Lightbulb } from 'lucide-react';

export default function ModuleGuideCard({
  stepNumber = 1,
  totalSteps = 1,
  title,
  description,
  tip,
  nextLabel,
  onNext,
  onExplore,
}) {
  const progress = Math.min(100, Math.max(0, (stepNumber / Math.max(1, totalSteps)) * 100));
  const hasNext = Boolean(onNext && nextLabel);

  return (
    <div className="module-guide-backdrop">
      <section
        className="module-guide-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="module-guide-title"
        aria-describedby="module-guide-description"
      >
        <div className="module-guide-accent-bar" />
        <div className="module-guide-modal-inner">
          <div className="module-guide-topline">
            <span className="module-guide-icon"><BookOpenCheck size={23} /></span>
            <span className="module-guide-eyebrow">GUIA INTERATIVO</span>
            <strong className="module-guide-step">Etapa {stepNumber} de {totalSteps}</strong>
          </div>

          <div className="module-guide-progress" aria-label={`${Math.round(progress)}% do guia concluído`}>
            <span style={{ width: progress + '%' }} />
          </div>

          <div className="module-guide-content">
            <span className="module-guide-kicker">ANTES DE EXPLORAR</span>
            <h2 id="module-guide-title">{title}</h2>
            <p id="module-guide-description">{description}</p>
            {tip && (
              <div className="module-guide-tip">
                <Lightbulb size={18} />
                <span>{tip}</span>
              </div>
            )}
          </div>

          <div className="module-guide-footer">
            <p>Leia esta orientação para entender o que você pode fazer nesta área.</p>
            <div className="module-guide-actions">
              {hasNext ? (
                <>
                  <button type="button" className="module-guide-next" onClick={onNext}>
                    Continuar para {nextLabel}
                    <ArrowRight size={18} />
                  </button>
                  <button type="button" className="module-guide-explore" onClick={onExplore}>
                    Entendi, explorar esta tela
                    <CheckCircle2 size={17} />
                  </button>
                </>
              ) : (
                <button type="button" className="module-guide-next" onClick={onExplore}>
                  Entendi, começar a explorar
                  <CheckCircle2 size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
