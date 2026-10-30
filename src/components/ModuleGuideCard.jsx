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
  return (
    <section className="module-guide-card" aria-label={`Guia da etapa ${stepNumber} de ${totalSteps}`}>
      <div className="module-guide-identity">
        <span className="module-guide-icon"><BookOpenCheck size={19} /></span>
        <span className="module-guide-label">GUIA RÁPIDO</span>
        <strong>Etapa {stepNumber} de {totalSteps}</strong>
      </div>

      <div className="module-guide-content">
        <span className="module-guide-kicker">ENTENDA ESTA ÁREA</span>
        <h2>{title}</h2>
        <p>{description}</p>
        {tip && (
          <div className="module-guide-tip">
            <Lightbulb size={15} />
            <span>{tip}</span>
          </div>
        )}
      </div>

      <div className="module-guide-actions">
        {onNext && nextLabel && (
          <button type="button" className="module-guide-next" onClick={onNext}>
            Continuar para {nextLabel}
            <ArrowRight size={16} />
          </button>
        )}
        <button type="button" className="module-guide-explore" onClick={onExplore}>
          Entendi, explorar esta tela
          <CheckCircle2 size={15} />
        </button>
      </div>
    </section>
  );
}
