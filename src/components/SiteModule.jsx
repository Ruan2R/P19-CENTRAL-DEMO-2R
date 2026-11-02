import { useState } from 'react';
import { ArrowRight, ArrowUpRight, Award, Camera, MapPin, Scissors, ShoppingBag, Sparkles, Star, Heart, Clock3 } from 'lucide-react';

const SITE_TEMPLATES = {
  Beauty: {
    initials: 'SB', customer: 'Studio Belle', label: 'BEAUTY STUDIO', city: 'Sidrolândia · MS',
    accent: '#b76d8f', secondary: '#f8edf2',
    tagline: 'BELEZA, TÉCNICA E CUIDADO',
    hero: 'Realce sua beleza. Revele sua melhor versão.',
    subtitle: 'Um espaço de beleza e cuidado com experiências personalizadas para valorizar cada detalhe, respeitando seu estilo e seus objetivos.',
    aboutTitle: 'Beleza com intenção.',
    about: 'Cada atendimento começa com uma conversa para entender o resultado que você procura. A proposta é unir técnica, cuidado e escolhas personalizadas em uma experiência acolhedora.',
    aboutSecond: 'Da extensão de cílios à maquiagem e aos cuidados labiais, cada serviço tem sua própria atenção aos detalhes.',
    action: 'Agendar horário',
    trust: ['Extensão de cílios', 'Maquiagem profissional', 'Cuidados labiais', 'Formação'],
    services: [
      { category: 'OLHAR', name: 'Extensão de cílios', description: 'Mapeamento e acabamento escolhidos de acordo com o formato dos olhos e o efeito desejado.', meta: 'Personalização em cada aplicação' },
      { category: 'PRODUÇÃO', name: 'Maquiagem profissional', description: 'Produções para eventos, fotos e ocasiões especiais, com opções de acabamento leve ou marcante.', meta: 'Express · Clássica · Glam' },
      { category: 'CUIDADO', name: 'Micropigmentação labial', description: 'Avaliação e técnica personalizada para valorizar contorno, cor e harmonia dos lábios.', meta: 'Avaliação antes do procedimento' },
      { category: 'FORMAÇÃO', name: 'Curso de extensão de cílios', description: 'Uma trilha de aprendizagem para quem deseja conhecer técnicas, materiais e rotina profissional.', meta: 'Conteúdo e acompanhamento' }
    ],
    details: [
      { name: 'Volume Brasileiro', desc: 'Clássico e delicado, para quem procura definição e presença sem perder a naturalidade.', ideal: 'Quem prefere um olhar elegante e equilibrado.', info: 'Aplicação demonstrativa · manutenção planejada' },
      { name: 'Volume Egípcio', desc: 'Mais densidade e destaque, com um resultado visualmente intenso e sofisticado.', ideal: 'Quem gosta de volume e impacto.', info: 'Técnica definida após avaliação' },
      { name: 'Foxy Eyes', desc: 'Mapeamento que direciona o olhar para um efeito alongado e expressivo.', ideal: 'Quem prefere um olhar mais alongado.', info: 'Mapeamento individual' },
      { name: 'Fio a Fio', desc: 'Fios aplicados de forma estratégica para valorizar a linha natural dos cílios.', ideal: 'Quem busca leveza e definição.', info: 'Resultado sob medida' },
      { name: 'Mega Brasileiro', desc: 'Uma proposta mais volumosa, com acabamento pensado para destacar o olhar.', ideal: 'Quem gosta de cílios cheios.', info: 'Aplicação demonstrativa' },
      { name: 'Mega Egípcio', desc: 'Volume de maior intensidade e presença, com avaliação do efeito adequado.', ideal: 'Quem procura um visual marcante.', info: 'Avaliação e mapeamento' }
    ],
    gallery: ['Cílios', 'Maquiagem', 'Cuidados', 'Formação'],
    testimonials: [
      { quote: 'O atendimento foi muito cuidadoso e o resultado ficou do jeito que eu imaginava.', author: 'Cliente demonstrativa', service: 'Extensão de cílios' },
      { quote: 'A produção ficou elegante, confortável e combinou com a ocasião.', author: 'Cliente demonstrativa', service: 'Maquiagem' },
      { quote: 'Gostei de poder conversar sobre o que eu queria antes de escolher a técnica.', author: 'Cliente demonstrativa', service: 'Atendimento personalizado' }
    ],
    note: 'Atendimento com hora marcada · informações e localização configuradas pelo negócio',
    extraTitle: 'Uma produção que acompanha a sua ocasião.',
    extraCopy: 'Apresente opções, explique o acabamento e ajude cada pessoa a encontrar a proposta que combina com seu estilo.'
  },
  Barber: {
    initials: 'BC', customer: 'Barber Club', label: 'BARBEARIA', city: 'Atendimento local · MS',
    accent: '#bd954e', secondary: '#f8f2e6',
    tagline: 'ESTILO, TÉCNICA E IDENTIDADE',
    hero: 'Seu estilo começa nos detalhes.',
    subtitle: 'Cortes, barba e acabamento com atenção ao seu estilo. Conheça os serviços e escolha a experiência que combina com você.',
    aboutTitle: 'Seu visual, do seu jeito.',
    about: 'Cada atendimento considera o estilo, o formato do rosto e a rotina de quem senta na cadeira. O objetivo é entregar um visual bem cuidado, com consistência e atenção.',
    aboutSecond: 'A experiência pode incluir corte, barba, acabamento e combinações de serviços em um único agendamento.',
    action: 'Agendar corte',
    trust: ['Cortes personalizados', 'Barba e acabamento', 'Combos de serviços', 'Agenda organizada'],
    services: [
      { category: 'CORTE', name: 'Corte degradê', description: 'Transições bem definidas e acabamento alinhado ao estilo escolhido.', meta: 'Consulta de estilo antes do corte' },
      { category: 'BARBA', name: 'Barba completa', description: 'Alinhamento, desenho e cuidado para valorizar o formato do rosto.', meta: 'Acabamento personalizado' },
      { category: 'COMBO', name: 'Corte + barba', description: 'Uma experiência completa para renovar o visual em um único horário.', meta: 'Serviços combinados' },
      { category: 'FINALIZAÇÃO', name: 'Acabamento', description: 'Ajustes de contorno e detalhes para manter o visual em dia.', meta: 'Atendimento objetivo' }
    ],
    details: [
      { name: 'Degradê clássico', desc: 'Laterais em transição gradual e topo ajustado ao estilo escolhido.', ideal: 'Quem procura um corte versátil.', info: 'Duração definida pelo serviço' },
      { name: 'Degradê baixo', desc: 'Transição discreta e acabamento limpo, mantendo proporção e naturalidade.', ideal: 'Quem prefere um visual mais sutil.', info: 'Duração definida pelo serviço' },
      { name: 'Barba desenhada', desc: 'Contorno e volume ajustados para harmonizar com o corte.', ideal: 'Quem valoriza linhas bem definidas.', info: 'Duração definida pelo serviço' },
      { name: 'Combo completo', desc: 'Corte, barba e finalização combinados no mesmo atendimento.', ideal: 'Quem quer resolver o visual em uma visita.', info: 'Tempo combinado na agenda' }
    ],
    gallery: ['Cortes', 'Barba', 'Acabamento', 'Ambiente'],
    testimonials: [
      { quote: 'O corte ficou alinhado com a referência e o atendimento foi pontual.', author: 'Cliente demonstrativo', service: 'Corte' },
      { quote: 'A barba ficou muito bem desenhada e o acabamento fez diferença.', author: 'Cliente demonstrativo', service: 'Barba' },
      { quote: 'Consegui escolher o horário e o combo sem precisar trocar mensagens.', author: 'Cliente demonstrativo', service: 'Agendamento' }
    ],
    note: 'Agenda organizada por serviço e profissional · dados ilustrativos',
    extraTitle: 'Técnica e consistência em cada atendimento.',
    extraCopy: 'Uma apresentação da rotina profissional: consulta de estilo, execução do serviço, acabamento e acompanhamento dos horários.'
  },
  Burger: {
    initials: 'BB', customer: 'Brasa Burger', label: 'HAMBURGUERIA', city: 'Operação local · MS',
    accent: '#d8753d', secondary: '#fff0e5',
    tagline: 'SABOR, PERSONALIDADE E PRATICIDADE',
    hero: 'Seu próximo burger favorito está aqui.',
    subtitle: 'Uma marca forte apresenta seus sabores, ingredientes e diferenciais antes de convidar o cliente para conhecer a casa.',
    aboutTitle: 'Feito com identidade.',
    about: 'Uma boa experiência começa antes do primeiro pedido: apresentação clara, cardápio organizado, informações úteis e uma comunicação que abre o apetite.',
    aboutSecond: 'A operação interna pode conectar pedidos, acompanhamento de preparo, produtos e estoque em um único ambiente de gestão.',
    action: 'Conhecer a operação',
    trust: ['Hambúrgueres artesanais', 'Combos da casa', 'Acompanhamentos', 'Atendimento'],
    services: [
      { category: 'HAMBÚRGUER', name: 'Smash clássico', description: 'Pão macio, blend preparado na chapa e combinação equilibrada de ingredientes.', meta: 'Um dos destaques da casa' },
      { category: 'COMBO', name: 'Combo Brasa', description: 'Uma opção completa para quem quer reunir burger, acompanhamento e bebida.', meta: 'Experiência completa' },
      { category: 'ACOMPANHAMENTO', name: 'Batata crocante', description: 'Acompanhamento para dividir ou completar o pedido.', meta: 'Preparado na hora' },
      { category: 'BEBIDAS', name: 'Bebidas geladas', description: 'Opções para acompanhar os sabores do cardápio.', meta: 'Consulte as opções' }
    ],
    details: [
      { name: 'Smash clássico', desc: 'Um burger direto ao ponto, com ingredientes que valorizam o sabor do blend.', ideal: 'Quem gosta de um clássico bem executado.', info: 'Produção sob pedido' },
      { name: 'Combo Brasa', desc: 'Burger, acompanhamento e bebida organizados em uma opção prática.', ideal: 'Quem prefere uma refeição completa.', info: 'Produção sob pedido' },
      { name: 'Smash duplo', desc: 'Mais camadas e presença para quem procura um lanche mais robusto.', ideal: 'Quem gosta de sabores intensos.', info: 'Produção sob pedido' },
      { name: 'Batata crocante', desc: 'Um acompanhamento para completar o pedido ou compartilhar.', ideal: 'Para acompanhar qualquer burger.', info: 'Produção sob pedido' }
    ],
    gallery: ['Burgers', 'Combos', 'Acompanhamentos', 'Ambiente'],
    testimonials: [
      { quote: 'O cardápio ficou fácil de entender e os destaques chamam atenção.', author: 'Cliente demonstrativo', service: 'Cardápio' },
      { quote: 'A apresentação da marca transmite cuidado e personalidade.', author: 'Cliente demonstrativo', service: 'Experiência' },
      { quote: 'A equipe consegue acompanhar melhor os pedidos e o preparo.', author: 'Cliente demonstrativo', service: 'Operação' }
    ],
    note: 'Cardápio ilustrativo · pedidos demonstrados na área interna da equipe',
    extraTitle: 'Uma operação organizada por trás do balcão.',
    extraCopy: 'A apresentação externa desperta o interesse. Na administração, a equipe pode lançar pedidos, acompanhar etapas e visualizar as movimentações de estoque.'
  }
};

export default function SiteModule({ activeDemo, siteSegment, setSiteSegment, onCta }) {
  const changeable = activeDemo.segment === 'Vitrine';
  const selected = SITE_TEMPLATES[siteSegment] || SITE_TEMPLATES.Beauty;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDetail, setActiveDetail] = useState(0);
  const [activeMakeup, setActiveMakeup] = useState('Clássica');
  const [galleryFilter, setGalleryFilter] = useState('Todos');
  const [testimonialIndex, setTestimonialIndex] = useState(0);
  const detail = selected.details[Math.min(activeDetail, selected.details.length - 1)] || selected.details[0];
  const makeupOptions = [
    { name: 'Express', description: 'Uma produção leve e prática para compromissos diurnos e momentos em que a naturalidade é prioridade.', ideal: 'Praticidade e leveza' },
    { name: 'Clássica', description: 'Uma maquiagem completa, equilibrando definição, acabamento e elegância para diferentes ocasiões.', ideal: 'Eventos, fotos e celebrações' },
    { name: 'Glam', description: 'Uma produção mais elaborada, com destaque para olhos, acabamento e presença visual.', ideal: 'Festas e ocasiões especiais' }
  ];
  const makeup = makeupOptions.find(item => item.name === activeMakeup) || makeupOptions[1];
  const galleryItems = selected.gallery.map((label, index) => ({ label, index }));
  const visibleGallery = galleryFilter === 'Todos' ? galleryItems : galleryItems.filter(item => item.label === galleryFilter);
  const testimonial = selected.testimonials[testimonialIndex] || selected.testimonials[0];
  const closeMobileMenu = () => setMobileMenuOpen(false);
  const selectSegment = (segment) => {
    setSiteSegment(segment);
    setActiveDetail(0);
    setActiveMakeup('Clássica');
    setGalleryFilter('Todos');
    setTestimonialIndex(0);
    closeMobileMenu();
  };

  return <div className={'site-demo site-demo-' + siteSegment.toLowerCase()} style={{ '--site-accent': selected.accent, '--site-soft': selected.secondary }}>
    <a className="site-demo-reference" href="https://ruan2r.github.io/P11-LANDING-PAGE-DANY/" target="_blank" rel="noopener noreferrer">
      <span>REFERÊNCIA DE ESTRUTURA · PROJETO P11 / DANIELLY</span>
      <strong>Ver landing page original <ArrowUpRight size={13}/></strong>
    </a>
    <header className="site-demo-header">
      <a className="site-demo-brand" href="#site-demo-start" onClick={closeMobileMenu}>
        <span className="site-demo-monogram">{selected.initials}</span>
        <span><strong>{selected.customer}</strong><small>{selected.label}</small></span>
      </a>
      <button className="site-demo-menu-toggle" type="button" onClick={() => setMobileMenuOpen(value => !value)} aria-expanded={mobileMenuOpen} aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}>{mobileMenuOpen ? 'Fechar' : 'Menu'}</button>
      <nav className={'site-demo-nav' + (mobileMenuOpen ? ' is-open' : '')} aria-label="Navegação da página demonstrativa">
        <a href="#site-demo-about" onClick={closeMobileMenu}>Sobre</a>
        <a href="#site-demo-services" onClick={closeMobileMenu}>{siteSegment === 'Burger' ? 'Cardápio' : 'Serviços'}</a>
        <a href="#site-demo-details" onClick={closeMobileMenu}>Diferenciais</a>
        <a href="#site-demo-results" onClick={closeMobileMenu}>Resultados</a>
        <button type="button" onClick={() => { closeMobileMenu(); onCta(); }}>{selected.action} <ArrowUpRight size={15}/></button>
      </nav>
    </header>

    {changeable && <div className="site-demo-switcher"><span>MODELO DA DEMONSTRAÇÃO</span>{Object.keys(SITE_TEMPLATES).map(segment => <button type="button" key={segment} className={siteSegment === segment ? 'active' : ''} onClick={() => selectSegment(segment)}>{segment}</button>)}</div>}

    <main className="site-demo-page">
      <section className="site-demo-hero" id="site-demo-start">
        <div className="site-demo-hero-copy">
          <span className="site-demo-eyebrow"><i/> {selected.tagline}</span>
          <p className="site-demo-name">{selected.customer.toUpperCase()}</p>
          <h2>{selected.hero}</h2>
          <p className="site-demo-lead">{selected.subtitle}</p>
          <div className="site-demo-hero-actions">
            <button type="button" className="site-demo-primary" onClick={onCta}>{selected.action} <ArrowRight size={17}/></button>
            <a className="site-demo-secondary" href="#site-demo-services">{siteSegment === 'Burger' ? 'Conhecer destaques' : 'Conhecer serviços'}</a>
          </div>
          <div className="site-demo-location-pill"><MapPin size={16}/><span><strong>{selected.city}</strong><small>{selected.note}</small></span></div>
        </div>
        <div className="site-demo-hero-art">
          <div className="site-demo-art-backdrop"/>
          <div className="site-demo-art-main">
            <span className="site-demo-art-label">{siteSegment === 'Beauty' ? 'BEAUTY EXPERIENCE' : siteSegment === 'Barber' ? 'BARBER EXPERIENCE' : 'BRASA EXPERIENCE'}</span>
            <div className="site-demo-art-symbol">{siteSegment === 'Beauty' ? <Sparkles size={72}/> : siteSegment === 'Barber' ? <Scissors size={72}/> : <ShoppingBag size={72}/>}</div>
            <strong>{siteSegment === 'Beauty' ? 'Beleza em cada detalhe' : siteSegment === 'Barber' ? 'Estilo em cada detalhe' : 'Sabor em cada detalhe'}</strong>
            <small>{siteSegment === 'Beauty' ? 'Cuidado que valoriza você' : siteSegment === 'Barber' ? 'Seu estilo, sua identidade' : 'Uma experiência feita para compartilhar'}</small>
          </div>
          <div className="site-demo-art-stamp"><span>2R</span><small>PROJETO DEMONSTRATIVO</small></div>
        </div>
      </section>

      <section className="site-demo-trust-strip" aria-label="Áreas de atuação">{selected.trust.map(item => <a key={item} href="#site-demo-services">{item}<ArrowUpRight size={13}/></a>)}</section>

      <section className="site-demo-section site-demo-about" id="site-demo-about">
        <div className="site-demo-section-index">01 / SOBRE A MARCA</div>
        <div className="site-demo-about-layout">
          <div className="site-demo-about-art"><span>{selected.initials}</span><small>{selected.label}</small><i/><b>{siteSegment === 'Beauty' ? 'CUIDADO & TÉCNICA' : siteSegment === 'Barber' ? 'ESTILO & PRECISÃO' : 'SABOR & IDENTIDADE'}</b></div>
          <div className="site-demo-about-copy">
            <span className="site-demo-kicker">{'PRAZER, SOMOS ' + selected.customer.toUpperCase()}</span>
            <h2>{selected.aboutTitle}</h2>
            <p>{selected.about}</p>
            <p>{selected.aboutSecond}</p>
            <div className="site-demo-signature"><span className="site-demo-signature-line"/><strong>{selected.customer}</strong><small>{selected.city}</small></div>
          </div>
        </div>
      </section>

      <section className="site-demo-section site-demo-services" id="site-demo-services">
        <div className="site-demo-section-heading">
          <div><div className="site-demo-section-index">02 / {siteSegment === 'Burger' ? 'CARDÁPIO' : 'SERVIÇOS'}</div><h2>{siteSegment === 'Burger' ? 'Conheça nossos destaques.' : 'O que fazemos por você.'}</h2></div>
          <p>{siteSegment === 'Beauty' ? 'Experiências de beleza pensadas para diferentes momentos, estilos e objetivos.' : siteSegment === 'Barber' ? 'Serviços organizados para facilitar a escolha e deixar claro o que faz parte de cada atendimento.' : 'Uma seleção de sabores, combinações e acompanhamentos para apresentar a identidade da casa.'}</p>
        </div>
        <div className="site-demo-service-grid">
          {selected.services.map((service, index) => <article className={'site-demo-service-card site-demo-service-card-' + index} key={service.name}>
            <div className="site-demo-service-art"><span>{String(index + 1).padStart(2, '0')}</span>{siteSegment === 'Beauty' ? <Sparkles size={36}/> : siteSegment === 'Barber' ? <Scissors size={36}/> : <ShoppingBag size={36}/>}<small>{service.category}</small></div>
            <div className="site-demo-service-copy"><span>{service.category}</span><h3>{service.name}</h3><p>{service.description}</p><small>{service.meta}</small><button type="button" onClick={onCta}>{siteSegment === 'Burger' ? 'Ver como funciona' : 'Conhecer atendimento'} <ArrowUpRight size={15}/></button></div>
          </article>)}
        </div>
      </section>

      <section className="site-demo-section site-demo-details" id="site-demo-details">
        <div className="site-demo-section-index">03 / EXPERIÊNCIA PERSONALIZADA</div>
        <div className="site-demo-detail-layout">
          <div className="site-demo-detail-copy">
            <span className="site-demo-kicker">{siteSegment === 'Beauty' ? 'EXTENSÃO DE CÍLIOS' : siteSegment === 'Barber' ? 'CORTE & BARBA' : 'DESTAQUES DA CASA'}</span>
            <h2>{siteSegment === 'Beauty' ? 'Cada detalhe fala por você.' : siteSegment === 'Barber' ? 'Um acabamento que combina com seu estilo.' : 'Escolhas que fazem a diferença.'}</h2>
            <p>{siteSegment === 'Beauty' ? 'Uma página completa não mostra apenas o nome e o valor do procedimento. Ela ajuda a pessoa a entender as opções, comparar resultados e escolher com mais segurança.' : siteSegment === 'Barber' ? 'Apresentar as diferenças entre os serviços ajuda o cliente a identificar o que procura antes de abrir a agenda.' : 'Apresentar os itens com descrição e contexto ajuda o cliente a conhecer melhor o cardápio.'}</p>
            <div className="site-demo-detail-tabs">{selected.details.map((item, index) => <button key={item.name} type="button" className={activeDetail === index ? 'active' : ''} onClick={() => setActiveDetail(index)}><span>{String(index + 1).padStart(2, '0')}</span>{item.name}</button>)}</div>
          </div>
          <article className="site-demo-detail-panel">
            <div className="site-demo-detail-art"><span>{siteSegment === 'Beauty' ? 'BEAUTY' : siteSegment === 'Barber' ? 'BARBER' : 'BRASA'}</span><div>{siteSegment === 'Beauty' ? <Sparkles size={54}/> : siteSegment === 'Barber' ? <Scissors size={54}/> : <ShoppingBag size={54}/>}</div></div>
            <div className="site-demo-detail-info"><span className="site-demo-kicker">DETALHE DA EXPERIÊNCIA</span><h3>{detail.name}</h3><p>{detail.desc}</p><div><small>INDICADO PARA</small><strong>{detail.ideal}</strong></div><div><small>INFORMAÇÕES</small><strong>{detail.info}</strong></div><button type="button" className="site-demo-text-link" onClick={onCta}>{siteSegment === 'Burger' ? 'Conhecer operação' : 'Consultar disponibilidade'} <ArrowRight size={16}/></button></div>
          </article>
        </div>
      </section>

      <section className="site-demo-section site-demo-extra">
        {siteSegment === 'Beauty' ? <>
          <div className="site-demo-section-index">04 / MAQUIAGEM PROFISSIONAL</div>
          <div className="site-demo-extra-layout">
            <div><span className="site-demo-kicker">BELEZA PARA CADA MOMENTO</span><h2>Uma produção que acompanha a sua ocasião.</h2><p>Apresente opções, explique o acabamento e ajude cada pessoa a encontrar a proposta que combina com seu estilo.</p>
              <div className="site-demo-detail-tabs site-demo-makeup-tabs">{['Express', 'Clássica', 'Glam'].map(name => <button key={name} type="button" className={activeMakeup === name ? 'active' : ''} onClick={() => setActiveMakeup(name)}>{name}</button>)}</div>
              <article className="site-demo-makeup-description"><strong>Make {makeup.name}</strong><p>{makeup.description}</p><small>Ideal para: {makeup.ideal}</small><button type="button" className="site-demo-text-link" onClick={onCta}>Consultar atendimento <ArrowRight size={16}/></button></article>
            </div>
            <div className="site-demo-makeup-art"><span>MAKEUP STUDIO</span><Sparkles size={72}/><small>EXPRESS · CLÁSSICA · GLAM</small></div>
          </div>
        </> : <>
          <div className="site-demo-section-index">04 / NOSSO DIFERENCIAL</div>
          <div className="site-demo-extra-layout">
            <div><span className="site-demo-kicker">{siteSegment === 'Barber' ? 'ATENÇÃO AOS DETALHES' : 'DA COZINHA À EXPERIÊNCIA'}</span><h2>{selected.extraTitle}</h2><p>{selected.extraCopy}</p><div className="site-demo-detail-points"><span>01 · Apresentação clara</span><span>02 · Informações organizadas</span><span>03 · Próximo passo acessível</span></div><button type="button" className="site-demo-text-link" onClick={onCta}>Conhecer a solução <ArrowRight size={16}/></button></div>
            <div className="site-demo-extra-art"><Award size={62}/><strong>{siteSegment === 'Barber' ? 'Precisão no corte.' : 'Qualidade em cada pedido.'}</strong><small>UMA EXPERIÊNCIA COM IDENTIDADE</small></div>
          </div>
        </>}
      </section>

      <section className="site-demo-section site-demo-results" id="site-demo-results">
        <div className="site-demo-section-heading"><div><div className="site-demo-section-index">05 / RESULTADOS</div><h2>{siteSegment === 'Beauty' ? 'Cada detalhe conta uma história.' : siteSegment === 'Barber' ? 'Inspirações para o seu próximo visual.' : 'Um pouco do que sai da nossa cozinha.'}</h2></div><p>Uma galeria visual pode mostrar o estilo do negócio e ajudar a pessoa a imaginar a própria experiência.</p></div>
        <div className="site-demo-gallery-filters">{['Todos', ...selected.gallery].map(item => <button key={item} type="button" className={galleryFilter === item ? 'active' : ''} onClick={() => setGalleryFilter(item)}>{item}</button>)}</div>
        <div className="site-demo-gallery">{visibleGallery.map(item => <article className={'site-demo-gallery-tile tile-' + item.index} key={item.label}><div>{siteSegment === 'Beauty' ? <Camera size={30}/> : siteSegment === 'Barber' ? <Scissors size={30}/> : <ShoppingBag size={30}/>}<span>{String(item.index + 1).padStart(2, '0')}</span></div><strong>{item.label}</strong><small>Imagem ilustrativa da categoria</small></article>)}</div>
      </section>

      <section className="site-demo-testimonials">
        <div className="site-demo-testimonial-heading"><div className="site-demo-section-index">06 / EXPERIÊNCIAS</div><h2>Uma experiência que vai além do resultado.</h2><p>Depoimentos demonstrativos mostram como a prova social pode fazer parte da página.</p></div>
        <article className="site-demo-testimonial-card"><span className="site-demo-quote-mark">“</span><p>{testimonial.quote}</p><div><strong>{testimonial.author}</strong><small>{testimonial.service}</small></div><div className="site-demo-testimonial-controls"><button type="button" aria-label="Depoimento anterior" onClick={() => setTestimonialIndex((testimonialIndex + selected.testimonials.length - 1) % selected.testimonials.length)}>‹</button>{selected.testimonials.map((item, index) => <button key={item.service + index} type="button" className={testimonialIndex === index ? 'active' : ''} aria-label={'Ver depoimento ' + (index + 1)} onClick={() => setTestimonialIndex(index)}/>)}<button type="button" aria-label="Próximo depoimento" onClick={() => setTestimonialIndex((testimonialIndex + 1) % selected.testimonials.length)}>›</button></div></article>
      </section>

      <section className="site-demo-section site-demo-location">
        <div className="site-demo-section-index">07 / LOCALIZAÇÃO E CONTATO</div>
        <div className="site-demo-location-layout"><div className="site-demo-map-placeholder"><MapPin size={36}/><span>LOCALIZAÇÃO DO NEGÓCIO</span><small>Mapa e rota configuráveis</small></div><div><span className="site-demo-kicker">VENHA CONHECER</span><h2>Estamos prontos para receber você.</h2><p>{selected.city}. As informações de endereço, horários e canais de contato podem ser configuradas de acordo com o negócio.</p><div className="site-demo-location-detail"><MapPin size={17}/><span><strong>{selected.city}</strong><small>Endereço e rota definidos pelo estabelecimento</small></span></div><button type="button" className="site-demo-primary" onClick={onCta}>{selected.action} <ArrowUpRight size={16}/></button></div></div>
      </section>

      <section className="site-demo-section site-demo-social">
        <div className="site-demo-section-heading"><div><div className="site-demo-section-index">08 / REDES SOCIAIS</div><h2>Mais do nosso trabalho.</h2></div><p>Uma área visual para conectar a landing page com a presença digital da marca.</p></div>
        <div className="site-demo-social-grid">{selected.gallery.map((item, index) => <div className={'site-demo-social-tile tile-' + index} key={item}><span>{item}</span><small>@{selected.customer.toLowerCase().replaceAll(' ', '')}</small></div>)}</div>
        <button type="button" className="site-demo-social-link" onClick={onCta}>Conhecer a marca <ArrowUpRight size={16}/></button>
      </section>

      <section className="site-demo-final-cta">
        <div><span className="site-demo-kicker">SEU PRÓXIMO PASSO</span><h2>{siteSegment === 'Beauty' ? 'Vamos cuidar de cada detalhe?' : siteSegment === 'Barber' ? 'Seu próximo visual começa aqui.' : 'Vamos preparar seu próximo pedido?'}</h2><p>Uma boa página reúne informação, identidade e um caminho simples para a pessoa entrar em contato.</p></div>
        <button type="button" className="site-demo-primary" onClick={onCta}>{selected.action} <ArrowRight size={17}/></button>
      </section>
    </main>
    <footer className="site-demo-footer"><span><strong>{selected.customer}</strong><small>PRÉVIA DEMONSTRATIVA · ESTRUTURA INSPIRADA EM PROJETOS REAIS DA 2R</small></span><button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Voltar ao início ↑</button></footer>
  </div>;
}
