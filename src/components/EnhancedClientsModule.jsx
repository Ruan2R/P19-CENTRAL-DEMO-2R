import { useMemo, useRef, useState } from 'react';
import { BadgeCheck, FileUp, Plus, Search, UserPlus, Users, X } from 'lucide-react';
import { parseVCardContacts } from '../lib/vcard.mjs';

function digits(value) { return String(value || '').replace(/\D/g, ''); }
function phoneDisplay(value) {
  const number = digits(value);
  if (number.length === 11) return '(' + number.slice(0, 2) + ') ' + number.slice(2, 7) + '-' + number.slice(7);
  if (number.length === 10) return '(' + number.slice(0, 2) + ') ' + number.slice(2, 6) + '-' + number.slice(6);
  return value || 'Telefone não informado';
}
function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

export default function EnhancedClientsModule({ clients, setClients, notify }) {
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [preview, setPreview] = useState(null);
  const [importMessage, setImportMessage] = useState('');
  const [importError, setImportError] = useState('');
  const fileRef = useRef(null);

  const filtered = useMemo(() => clients.filter(client => {
    const term = normalize(query);
    if (!term) return true;
    const contact = client.contact || client.phone || '';
    return normalize(client.name).includes(term) || digits(contact).includes(digits(term)) || normalize(contact).includes(term);
  }), [clients, query]);

  function submitCustomer(event) {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    if (cleanName.length < 2) return;
    const phoneDigits = digits(cleanPhone);
    const duplicate = clients.some(client => normalize(client.name) === normalize(cleanName) || (phoneDigits && digits(client.contact || client.phone) === phoneDigits));
    if (duplicate) {
      notify('Já existe um cadastro com esse nome ou telefone nesta demonstração.');
      return;
    }
    setClients(previous => [{ name: cleanName, contact: cleanPhone || 'Telefone não informado', visits: 0, last: 'Sem visitas' }, ...previous]);
    setName('');
    setPhone('');
    setShowForm(false);
    notify('Cliente fictício adicionado à lista.');
  }

  async function readContactFile(event) {
    const file = event.currentTarget.files && event.currentTarget.files[0];
    event.currentTarget.value = '';
    setImportError('');
    setImportMessage('');
    setPreview(null);
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setImportError('O arquivo é muito grande. Selecione um vCard (.vcf) menor que 10 MB.');
      return;
    }
    try {
      const parsed = parseVCardContacts(await file.text());
      if (parsed.contacts.length > 5000) {
        setImportError('O arquivo tem mais de 5.000 contatos válidos. Exporte uma lista menor.');
        return;
      }
      if (!parsed.contacts.length && !parsed.ignored) {
        setImportError('Não encontrei contatos neste arquivo. Selecione um vCard (.vcf) exportado dos Contatos.');
        return;
      }
      setPreview({ fileName: file.name, contacts: parsed.contacts, ignored: parsed.ignored });
    } catch {
      setImportError('Não foi possível ler esse arquivo. Exporte novamente como vCard (.vcf).');
    }
  }

  function importContacts() {
    if (!preview) return;
    let created = 0;
    let duplicates = 0;
    const current = [...clients];
    for (const item of preview.contacts) {
      const phone = item.phone ? phoneDisplay(item.phone) : '';
      const phoneDigits = digits(phone);
      const duplicate = current.some(client => normalize(client.name) === normalize(item.name) || (phoneDigits && digits(client.contact || client.phone) === phoneDigits));
      if (duplicate) {
        duplicates += 1;
        continue;
      }
      current.unshift({ name: item.name, contact: phone || 'Telefone não informado', visits: 0, last: 'Sem visitas' });
      created += 1;
    }
    setClients(current);
    setImportMessage('Importação concluída: ' + created + ' adicionados · ' + duplicates + ' duplicados ignorados · ' + preview.ignored + ' inválidos ignorados.');
    setPreview(null);
    notify('Importação de contatos concluída.');
  }

  return <>
    <section className="panel table-panel customers-admin-panel">
      <div className="panel-heading customers-admin-heading">
        <div><span className="eyebrow muted-eyebrow">CADASTRO E ORGANIZAÇÃO</span><h3>Clientes cadastrados</h3><p>{clients.length} registros fictícios na demonstração.</p></div>
        <div className="customers-admin-actions">
          <button type="button" className="secondary-button" onClick={() => { setShowImport(value => !value); setImportError(''); setImportMessage(''); }}><FileUp size={15}/> Importar contatos</button>
          <button type="button" className="primary-button" onClick={() => setShowForm(value => !value)}><UserPlus size={15}/>{showForm ? 'Fechar cadastro' : 'Adicionar cliente'}</button>
        </div>
      </div>

      <div className="customers-admin-note"><BadgeCheck size={16}/><span>O cadastro manual e a importação vCard abaixo são demonstrativos. Os dados ficam somente nesta prévia e são reiniciados ao recarregar a página.</span></div>

      {showForm && <form className="customer-demo-form" onSubmit={submitCustomer}>
        <label>Nome completo<input value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={100} required placeholder="Nome do cliente"/></label>
        <label>Telefone / WhatsApp<input type="tel" inputMode="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="(67) 99999-9999" maxLength={16}/></label>
        <div className="customer-demo-form-actions"><button type="submit" className="primary-button"><Plus size={15}/> Cadastrar cliente</button><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancelar</button></div>
      </form>}

      {showImport && <section className="customer-import-panel">
        <div><strong>Importar contatos do celular</strong><p>Selecione um arquivo vCard (.vcf). Usaremos somente nome e telefone; os demais campos do contato serão ignorados.</p></div>
        <input ref={fileRef} type="file" accept=".vcf,.vcard,text/vcard" onChange={readContactFile}/>
        {importError && <p className="contact-import-message error" role="alert">{importError}</p>}
        {preview && <div className="contact-import-preview">
          <strong>{preview.fileName}</strong>
          <span>{preview.contacts.length} contatos encontrados · {preview.contacts.filter(item => item.phone).length} com telefone · {preview.contacts.filter(item => !item.phone).length} sem telefone · {preview.ignored} inválidos</span>
          <small>Duplicados por nome ou telefone serão ignorados. Nada será enviado a um sistema externo.</small>
          <div className="customer-demo-form-actions"><button type="button" className="primary-button" disabled={!preview.contacts.length} onClick={importContacts}>Importar {preview.contacts.length} contatos</button><button type="button" className="secondary-button" onClick={() => setPreview(null)}>Cancelar</button></div>
        </div>}
        {importMessage && <p className="contact-import-message success" role="status">{importMessage}</p>}
      </section>}

      <label className="search-box compact customers-admin-search"><Search size={16}/><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Pesquisar por nome ou telefone"/></label>

      {filtered.length ? <div className="data-table customers-admin-table">
        <div className="table-head client-head"><span>Cliente</span><span>Contato</span><span>Atendimentos</span><span>Última visita</span></div>
        {filtered.map(client => <div className="table-row client-head" key={client.name}>
          <span className="client-cell"><span className="table-avatar">{client.name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()}</span><strong>{client.name}</strong></span>
          <span className="muted-text">{phoneDisplay(client.contact || client.phone)}</span>
          <span>{client.visits ?? 0}</span>
          <span className="muted-text">{client.last || 'Sem visitas'}</span>
        </div>)}
      </div> : <div className="empty-table"><Users size={24}/><strong>Nenhum cliente encontrado</strong><span>Altere a busca ou cadastre um novo contato.</span></div>}
    </section>
  </>;
}
