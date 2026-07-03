// ═══════════════════════════════════════
//  ESTADO GLOBAL
// ═══════════════════════════════════════
let user_id = null;
let user_nome = 'Usuário';
let abaAtual = 'explorar';
let chatAtivoId = null;
let chatDestinatarioId = null;
let canalMensagens = null;
let termoBusca = '';
let buscaTimer = null;
let livroEditandoId = null;
let cacheLivros = [];
let cachePerfis = new Map();
let perfilUsuarioAtual = null;
let cacheBiblioteca = [];
let metaLeituraAtual = null;
let livroBibliotecaEditandoId = null;
let livroAtualLeituraId = null;
let fotosAnuncioAtual = [];
let cacheAvaliacoesResumo = new Map();
let detalhesLivroAtual = null;
let notaSelecionadaDetalhes = 0;
let checkoutLivros = [];

const container = document.getElementById('livros');

const GENRE_COLORS = {
    'Ficção': '#60a5fa',
    'Romance': '#f472b6',
    'Terror': '#f87171',
    'Técnico': '#fbbf24',
    'Didático': '#38bdf8',
    'Acadêmico': '#a78bfa',
    'Outros': '#9ca3af',
};

const TIPO_LABELS = {
    troca: '🔄 Troca',
    venda: '💰 Venda',
    ambos: '🔄 Troca / 💰 Venda',
};

const TIPOS_VALIDOS = ['troca', 'venda', 'ambos'];

const ESTADO_LABELS = {
    novo: 'Novo',
    seminovo: 'Seminovo',
    usado_bom: 'Usado em bom estado',
    usado_marcado: 'Usado com marcas',
    danificado: 'Com avarias',
};

const ESTADOS_VALIDOS = Object.keys(ESTADO_LABELS);
const LIMITE_FOTOS_ANUNCIO = 4;

function getEstadoLivroSeguro(estado) {
    return ESTADOS_VALIDOS.includes(estado) ? estado : 'usado_bom';
}

function getFotosLivro(livro) {
    const fotos = livro?.fotos;
    if (Array.isArray(fotos)) return fotos.filter(Boolean);
    if (typeof fotos === 'string' && fotos.trim()) {
        try {
            const parsed = JSON.parse(fotos);
            if (Array.isArray(parsed)) return parsed.filter(Boolean);
        } catch (_) {
            return [fotos];
        }
    }
    if (livro?.foto_url) return [livro.foto_url];
    return [];
}

function fotoSegura(src) {
    return typeof src === 'string' && (
        src.startsWith('data:image/') ||
        src.startsWith('https://') ||
        src.startsWith('http://')
    );
}

function renderCapaLivro(livro, classeExtra = '') {
    const fotos = getFotosLivro(livro).filter(fotoSegura);
    if (fotos.length > 0) {
        return `<div class="book-cover book-cover-photo ${classeExtra}"><img src="${escapeHTML(fotos[0])}" alt="Foto do livro ${escapeHTML(livro?.titulo || '')}"></div>`;
    }
    return `<div class="book-cover ${classeExtra}">${escapeHTML(getIniciais(livro?.titulo))}</div>`;
}

function renderContadorFotos(livro) {
    const total = getFotosLivro(livro).length;
    return total > 1 ? `<span class="photo-count">+${total - 1} foto${total - 1 > 1 ? 's' : ''}</span>` : '';
}

function renderRatingStars(nota = 0) {
    const n = Math.round(Number(nota || 0));
    return Array.from({ length: 5 }, (_, i) => i < n ? '★' : '☆').join('');
}

function getResumoAvaliacao(livroId) {
    return cacheAvaliacoesResumo.get(String(livroId)) || { media: 0, total: 0 };
}

function renderResumoAvaliacao(livroId) {
    const resumo = getResumoAvaliacao(livroId);
    if (!resumo.total) return '<span class="rating-summary empty-rating">Sem avaliações</span>';
    return `<span class="rating-summary"><b>${renderRatingStars(resumo.media)}</b> ${resumo.media.toFixed(1).replace('.', ',')} (${resumo.total})</span>`;
}


function escapeHTML(valor) {
    return String(valor ?? '').replace(/[&<>'"]/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
    }[char]));
}

function normalizarTexto(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function formatarPreco(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    });
}

function getTipoSeguro(tipo) {
    return TIPOS_VALIDOS.includes(tipo) ? tipo : 'troca';
}

function getIniciais(titulo) {
    const partes = String(titulo || 'Livro').trim().split(/\s+/).slice(0, 2);
    return partes.map(p => p[0]?.toUpperCase()).join('') || '📚';
}

function calcularTaxaPlataforma(valor) {
    // Simulação acadêmica de monetização: 8% sobre vendas concluídas.
    return Number(valor || 0) * 0.08;
}

// ═══════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════
function getToastContainer() {
    let c = document.getElementById('toast-container');
    if (!c) {
        c = document.createElement('div');
        c.id = 'toast-container';
        c.className = 'toast-container';
        document.body.appendChild(c);
    }
    return c;
}

function toast(msg, tipo = 'success') {
    const c = getToastContainer();
    const t = document.createElement('div');
    t.className = `toast toast-${tipo}`;
    t.textContent = msg;
    c.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
    setTimeout(() => {
        t.classList.remove('show');
        setTimeout(() => t.remove(), 300);
    }, 3200);
}

// ═══════════════════════════════════════
//  SACOLA / COMPRA SIMULADA
// ═══════════════════════════════════════
function getSacolaKey() {
    return `sebo_virtual_sacola_${user_id || 'anon'}`;
}

function getSacolaIds() {
    try {
        const ids = JSON.parse(localStorage.getItem(getSacolaKey()) || '[]');
        return Array.isArray(ids) ? ids.map(String) : [];
    } catch (_) {
        return [];
    }
}

function salvarSacolaIds(ids) {
    const unicos = [...new Set(ids.map(String))];
    localStorage.setItem(getSacolaKey(), JSON.stringify(unicos));
    atualizarBadgeSacola();
}

function atualizarBadgeSacola() {
    const badge = document.getElementById('badgeSacola');
    if (badge) badge.textContent = getSacolaIds().length;
}

function livroNaSacola(id) {
    return getSacolaIds().includes(String(id));
}

window.adicionarNaSacola = function (livroId) {
    const livro = cacheLivros.find(l => String(l.id) === String(livroId));
    if (!livro) {
        toast('Livro não encontrado.', 'error');
        return;
    }

    if (livro.dono === user_id) {
        toast('Você não pode colocar seu próprio anúncio na sacola.', 'info');
        return;
    }

    const ids = getSacolaIds();
    if (ids.includes(String(livroId))) {
        toast('Esse livro já está na sua sacola.', 'info');
        return;
    }

    ids.push(String(livroId));
    salvarSacolaIds(ids);
    toast('Livro adicionado à sacola.');
    if (abaAtual === 'explorar') mostrarLivros();
};

window.removerDaSacola = function (livroId) {
    salvarSacolaIds(getSacolaIds().filter(id => id !== String(livroId)));
    toast('Livro removido da sacola.', 'info');
    if (abaAtual === 'sacola') mostrarSacola();
    if (abaAtual === 'explorar') mostrarLivros();
};

async function enviarPropostaAutomatica(livro) {
    const tipo = getTipoSeguro(livro.tipo);
    const texto = tipo === 'troca'
        ? `Olá! Tenho interesse em propor uma troca pelo livro "${livro.titulo}".`
        : `Olá! Tenho interesse em comprar o livro "${livro.titulo}" por ${formatarPreco(livro.preco)}. Podemos conversar?`;

    const { data, error } = await _supabase.from('mensagens').insert([{
        livro_id: livro.id,
        sender_id: user_id,
        receiver_id: livro.dono,
        sender_nome: user_nome,
        texto,
    }]).select().single();

    if (error) throw error;
    return data;
}

window.confirmarInteresse = async function (livroId) {
    const livro = cacheLivros.find(l => String(l.id) === String(livroId));
    if (!livro) {
        toast('Livro não encontrado.', 'error');
        return;
    }

    if (livro.dono === user_id) {
        toast('Esse anúncio é seu.', 'info');
        return;
    }

    const tipo = getTipoSeguro(livro.tipo);
    const titulo = livro.titulo || 'este livro';

    if (tipo !== 'troca' && Number(livro.preco || 0) > 0) {
        abrirCheckout([livro.id]);
        return;
    }

    const pergunta = `Enviar uma proposta de troca pelo livro "${titulo}"?`;
    if (!confirm(pergunta)) return;

    try {
        await enviarPropostaAutomatica(livro);
        toast('Proposta enviada! Abrindo chat...');
        removerDaSacola(livro.id);
        abrirChat(livro.id, livro.titulo, livro.dono);
    } catch (err) {
        toast('Erro ao enviar proposta: ' + err.message, 'error');
    }
};

window.enviarPropostasSacola = async function () {
    const livrosSacola = getLivrosDaSacola();
    if (livrosSacola.length === 0) return;
    abrirCheckout(livrosSacola.map(l => l.id));
};

window.abrirCheckout = function (livroIds = null) {
    const ids = Array.isArray(livroIds) ? livroIds.map(String) : getSacolaIds();
    checkoutLivros = cacheLivros.filter(l => ids.includes(String(l.id)) && l.dono !== user_id);

    if (checkoutLivros.length === 0) {
        toast('Nenhum livro disponível para finalizar.', 'info');
        return;
    }

    const overlay = document.getElementById('checkoutOverlay');
    const lista = document.getElementById('checkoutLista');
    const totalEl = document.getElementById('checkoutTotal');
    const obs = document.getElementById('checkoutObservacao');
    if (!overlay || !lista) return;

    const total = checkoutLivros.reduce((soma, livro) => soma + Number(livro.preco || 0), 0);
    lista.innerHTML = checkoutLivros.map(livro => {
        const dono = cachePerfis.get(livro.dono);
        const tipo = getTipoSeguro(livro.tipo);
        return `
            <article class="checkout-item">
                ${renderCapaLivro(livro, 'checkout-cover')}
                <div>
                    <strong>${escapeHTML(livro.titulo || 'Livro sem título')}</strong>
                    <span>${escapeHTML(livro.autor || 'Autor não informado')}</span>
                    <small>${escapeHTML(ESTADO_LABELS[getEstadoLivroSeguro(livro.estado)])} • ${escapeHTML(dono?.nome || 'Vendedor')}</small>
                </div>
                <b>${tipo !== 'troca' && Number(livro.preco || 0) > 0 ? formatarPreco(livro.preco) : 'Troca'}</b>
            </article>`;
    }).join('');

    if (totalEl) totalEl.textContent = formatarPreco(total);
    if (obs) obs.value = '';
    overlay.style.display = 'flex';
};

window.fecharCheckout = function () {
    const overlay = document.getElementById('checkoutOverlay');
    if (overlay) overlay.style.display = 'none';
    checkoutLivros = [];
};

async function criarPedidoCompra(livro, entrega, observacao) {
    const valor = Number(livro.preco || 0);
    const { data, error } = await _supabase.from('pedidos').insert([{
        comprador_id: user_id,
        vendedor_id: livro.dono,
        livro_id: livro.id,
        status: 'aberto',
        valor,
        forma_entrega: entrega,
        observacao,
    }]).select().single();

    if (error) throw error;

    const entregaLabel = {
        combinar: 'combinar com o vendedor',
        retirada: 'retirada presencial',
        envio: 'envio a combinar',
    }[entrega] || 'combinar com o vendedor';

    const texto = `Olá! Enviei um pedido pelo livro "${livro.titulo}"${valor > 0 ? ` no valor de ${formatarPreco(valor)}` : ''}. Forma de entrega: ${entregaLabel}.${observacao ? ` Observação: ${observacao}` : ''}`;

    await _supabase.from('mensagens').insert([{
        livro_id: livro.id,
        sender_id: user_id,
        receiver_id: livro.dono,
        sender_nome: user_nome,
        texto,
    }]);

    return data;
}

window.finalizarPedido = async function () {
    if (!checkoutLivros.length) return;
    const btn = document.getElementById('btnFinalizarPedido');
    const entrega = document.getElementById('checkoutEntrega')?.value || 'combinar';
    const observacao = document.getElementById('checkoutObservacao')?.value.trim() || '';

    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Enviando...';
    }

    let pedidosCriados = 0;
    try {
        for (const livro of checkoutLivros) {
            await criarPedidoCompra(livro, entrega, observacao);
            pedidosCriados++;
        }

        const ids = checkoutLivros.map(l => String(l.id));
        salvarSacolaIds(getSacolaIds().filter(id => !ids.includes(String(id))));
        fecharCheckout();
        toast(`${pedidosCriados} pedido(s) enviado(s). Abra Propostas ou Chat para acompanhar.`);
        if (abaAtual === 'sacola') mostrarSacola();
    } catch (err) {
        toast('Erro ao finalizar pedido: ' + (err.message || 'verifique se a tabela pedidos foi criada no Supabase.'), 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Enviar pedido';
        }
    }
};

function getLivrosDaSacola() {
    const ids = getSacolaIds();
    return cacheLivros.filter(l => ids.includes(String(l.id)) && l.dono !== user_id);
}

// ═══════════════════════════════════════
//  INICIALIZAÇÃO
// ═══════════════════════════════════════
async function inicializar() {
    const { data: { user }, error: userError } = await _supabase.auth.getUser();
    if (userError || !user) {
        window.location.href = 'login.html';
        return;
    }

    user_id = user.id;
    atualizarBadgeSacola();

    let perfilResp = await _supabase
        .from('profiles')
        .select('nome, cidade, whatsapp, is_admin, foto_url')
        .eq('id', user_id)
        .single();

    if (perfilResp.error && String(perfilResp.error.message || '').toLowerCase().includes('foto_url')) {
        perfilResp = await _supabase
            .from('profiles')
            .select('nome, cidade, whatsapp, is_admin')
            .eq('id', user_id)
            .single();
    }

    const perfil = perfilResp.data;

    if (!perfil || !perfil.nome) {
        window.location.href = 'perfil.html';
        return;
    }

    user_nome = perfil.nome;
    perfilUsuarioAtual = perfil;
    document.getElementById('user').textContent = user_nome;
    aplicarAvatarUsuario('headerAvatar', user_nome, perfil.foto_url);

    if (perfil.is_admin && !document.getElementById('btn-admin')) {
        const nav = document.querySelector('nav');
        const btnAdmin = document.createElement('button');
        btnAdmin.id = 'btn-admin';
        btnAdmin.textContent = 'Admin';
        btnAdmin.onclick = () => window.location.href = 'admin.html';
        nav.appendChild(btnAdmin);
    }

    mudarAba('explorar', document.getElementById('btn-explorar'));
}

// ═══════════════════════════════════════
//  NAVEGAÇÃO E FILTROS
// ═══════════════════════════════════════
window.mudarAba = function (aba, elemento) {
    abaAtual = aba;

    document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('ativo'));
    if (elemento) elemento.classList.add('ativo');

    const form = document.getElementById('formSection');
    const filtros = document.getElementById('filtrosArea');
    const hero = document.getElementById('heroPanel');
    const metricas = document.getElementById('metricasSite');
    const categorias = document.getElementById('categoriasRapidas');
    const trustStrip = document.getElementById('trustStrip');
    const bibliotecaPage = document.getElementById('bibliotecaPage');
    const sectionHeading = document.getElementById('sectionHeading');

    const abaCatalogo = ['explorar', 'meus', 'sacola', 'interesses'].includes(aba);
    form.style.display = (aba === 'meus') ? 'block' : 'none';
    filtros.style.display = (aba === 'explorar' || aba === 'meus') ? 'flex' : 'none';
    hero.style.display = (aba === 'explorar') ? 'grid' : 'none';
    metricas.style.display = (aba === 'explorar') ? 'grid' : 'none';
    categorias.style.display = (aba === 'explorar') ? 'flex' : 'none';
    trustStrip.style.display = (aba === 'explorar' || aba === 'sacola') ? 'grid' : 'none';
    if (bibliotecaPage) bibliotecaPage.style.display = (aba === 'biblioteca') ? 'block' : 'none';
    if (sectionHeading) sectionHeading.style.display = abaCatalogo ? 'flex' : 'none';
    if (container) container.style.display = abaCatalogo ? 'grid' : 'none';

    if (aba !== 'meus') cancelarEdicao(false);

    atualizarTituloSecao();

    if (aba === 'biblioteca') {
        carregarPainelLeitura();
        return;
    }

    if (aba === 'interesses') {
        mostrarInteresses();
    } else if (aba === 'sacola') {
        mostrarLivrosBase().then(mostrarSacola);
    } else {
        mostrarLivros();
    }
};

function atualizarTituloSecao(total = 0) {
    const eyebrow = document.getElementById('sectionEyebrow');
    const title = document.getElementById('sectionTitle');
    const contador = document.getElementById('resultadoContador');

    if (abaAtual === 'explorar') {
        eyebrow.textContent = 'Acervo disponível';
        title.textContent = 'Livros em destaque';
    } else if (abaAtual === 'sacola') {
        eyebrow.textContent = 'Minha sacola';
        title.textContent = 'Livros escolhidos para negociar';
    } else if (abaAtual === 'interesses') {
        eyebrow.textContent = 'Central de propostas';
        title.textContent = 'Conversas recebidas';
    } else {
        eyebrow.textContent = 'Meus anúncios';
        title.textContent = 'Gerencie seus livros cadastrados';
    }

    contador.textContent = `${total} resultado${total === 1 ? '' : 's'}`;
}

window.togglePreco = function () {
    const tipo = document.getElementById('tipoAnuncio').value;
    const preco = document.getElementById('precoLivro');
    preco.style.display = (tipo === 'venda' || tipo === 'ambos') ? 'block' : 'none';
};

window.buscarLivros = function () {
    termoBusca = document.getElementById('busca').value.trim();
    clearTimeout(buscaTimer);
    buscaTimer = setTimeout(mostrarLivros, 250);
};

window.limparFiltros = function () {
    document.getElementById('busca').value = '';
    document.getElementById('filtroGenero').value = 'Todos';
    document.getElementById('filtroTipo').value = 'Todos';
    document.getElementById('filtroOrdenacao').value = 'recentes';
    const filtroAvaliacao = document.getElementById('filtroAvaliacao');
    if (filtroAvaliacao) filtroAvaliacao.value = 'Todos';
    termoBusca = '';
    sincronizarChips();
    mostrarLivros();
};

window.filtrarGeneroRapido = function (genero) {
    const select = document.getElementById('filtroGenero');
    if (select) select.value = genero;
    sincronizarChips();
    mostrarLivros();
};

window.sincronizarChips = function () {
    const genero = document.getElementById('filtroGenero')?.value || 'Todos';
    document.querySelectorAll('.quick-chip').forEach(chip => {
        chip.classList.toggle('active', chip.textContent.trim() === genero);
    });
};

function atualizarStats(livros) {
    const disponiveis = livros.filter(l => l.dono !== user_id);
    const meus = livros.filter(l => l.dono === user_id).length;
    const venda = disponiveis.filter(l => ['venda', 'ambos'].includes(getTipoSeguro(l.tipo))).length;
    const troca = disponiveis.filter(l => ['troca', 'ambos'].includes(getTipoSeguro(l.tipo))).length;

    const elDisponiveis = document.getElementById('statDisponiveis');
    const elMeus = document.getElementById('statMeusLivros');
    const elVenda = document.getElementById('statVenda');
    const elTroca = document.getElementById('statTroca');

    if (elDisponiveis) elDisponiveis.textContent = disponiveis.length;
    if (elMeus) elMeus.textContent = meus;
    if (elVenda) elVenda.textContent = venda;
    if (elTroca) elTroca.textContent = troca;

    atualizarDestaque(disponiveis);
}

function atualizarDestaque(disponiveis) {
    const destaque = document.getElementById('destaqueLivro');
    if (!destaque) return;

    const comPreco = disponiveis.find(l => Number(l.preco) > 0) || disponiveis[0];
    if (!comPreco) {
        destaque.innerHTML = `
            <span class="market-label">Destaque do acervo</span>
            <strong>Nenhum livro disponível</strong>
            <small>Cadastre livros para deixar seu catálogo mais completo.</small>
        `;
        return;
    }

    const tipo = getTipoSeguro(comPreco.tipo);
    destaque.innerHTML = `
        <span class="market-label">Destaque do acervo</span>
        <div class="book-cover mini-cover">${escapeHTML(getIniciais(comPreco.titulo))}</div>
        <strong>${escapeHTML(comPreco.titulo)}</strong>
        <small>${escapeHTML(comPreco.autor || 'Autor não informado')}</small>
        <em>${tipo !== 'troca' && Number(comPreco.preco) > 0 ? formatarPreco(comPreco.preco) : 'Disponível para troca'}</em>
    `;
}


// ═══════════════════════════════════════
//  FOTOS DO ANÚNCIO
// ═══════════════════════════════════════
function comprimirImagemArquivo(file) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
            resolve(null);
            return;
        }

        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error('Imagem inválida.'));
            img.onload = () => {
                const max = 950;
                const escala = Math.min(1, max / Math.max(img.width, img.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(img.width * escala));
                canvas.height = Math.max(1, Math.round(img.height * escala));
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.72));
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

window.handleFotosAnuncioChange = async function (input) {
    const arquivos = Array.from(input?.files || []).filter(file => file.type.startsWith('image/'));
    if (arquivos.length === 0) return;

    const vagas = LIMITE_FOTOS_ANUNCIO - fotosAnuncioAtual.length;
    if (vagas <= 0) {
        toast(`Você pode adicionar até ${LIMITE_FOTOS_ANUNCIO} fotos por anúncio.`, 'info');
        input.value = '';
        return;
    }

    const selecionados = arquivos.slice(0, vagas);
    try {
        const imagens = (await Promise.all(selecionados.map(comprimirImagemArquivo))).filter(Boolean);
        fotosAnuncioAtual = [...fotosAnuncioAtual, ...imagens].slice(0, LIMITE_FOTOS_ANUNCIO);
        renderPreviewFotosAnuncio();
        if (arquivos.length > vagas) toast(`Foram adicionadas apenas ${vagas} foto(s), pois o limite é ${LIMITE_FOTOS_ANUNCIO}.`, 'info');
    } catch (error) {
        toast('Erro ao carregar imagem: ' + error.message, 'error');
    } finally {
        input.value = '';
    }
};

function renderPreviewFotosAnuncio() {
    const preview = document.getElementById('previewFotosLivro');
    if (!preview) return;

    if (!fotosAnuncioAtual.length) {
        preview.className = 'preview-fotos empty-preview';
        preview.textContent = 'Nenhuma foto adicionada';
        return;
    }

    preview.className = 'preview-fotos';
    preview.innerHTML = fotosAnuncioAtual.map((foto, index) => `
        <div class="foto-thumb">
            <img src="${escapeHTML(foto)}" alt="Foto ${index + 1} do anúncio">
            <button type="button" onclick="removerFotoAnuncio(${index})" title="Remover foto">×</button>
        </div>
    `).join('');
}

window.removerFotoAnuncio = function (index) {
    fotosAnuncioAtual.splice(index, 1);
    renderPreviewFotosAnuncio();
};

// ═══════════════════════════════════════
//  CADASTRAR / EDITAR LIVRO
// ═══════════════════════════════════════
window.adicionarLivro = async function () {
    const titulo = document.getElementById('titulo').value.trim();
    const autor = document.getElementById('autor').value.trim();
    const genero = document.getElementById('generoCadastro').value;
    const tipo = document.getElementById('tipoAnuncio').value;
    const estado = getEstadoLivroSeguro(document.getElementById('estadoLivro')?.value || 'usado_bom');
    const preco = parseFloat(document.getElementById('precoLivro').value) || 0;

    if (!titulo || !autor) {
        toast('Preencha o título e o autor.', 'error');
        return;
    }

    if ((tipo === 'venda' || tipo === 'ambos') && preco <= 0) {
        toast('Informe um preço válido para venda.', 'error');
        return;
    }

    const btn = document.getElementById('btnSalvarLivro');
    btn.disabled = true;
    btn.textContent = livroEditandoId ? 'Salvando alterações...' : 'Salvando...';

    const dadosLivro = {
        titulo,
        autor,
        genero,
        tipo,
        estado,
        fotos: fotosAnuncioAtual,
        preco: (tipo !== 'troca') ? preco : 0,
        dono: user_id,
    };

    const operacao = livroEditandoId
        ? _supabase.from('livros').update(dadosLivro).eq('id', livroEditandoId).eq('dono', user_id)
        : _supabase.from('livros').insert([dadosLivro]);

    const { error } = await operacao;

    btn.disabled = false;
    btn.textContent = livroEditandoId ? 'Salvar alterações' : 'Adicionar anúncio';

    if (error) {
        toast('Erro ao salvar: ' + error.message, 'error');
        return;
    }

    toast(livroEditandoId ? 'Livro atualizado com sucesso!' : 'Livro cadastrado com sucesso! 📚');
    limparFormularioLivro();
    cancelarEdicao(false);
    mostrarLivros();
};

function limparFormularioLivro() {
    document.getElementById('titulo').value = '';
    document.getElementById('autor').value = '';
    document.getElementById('generoCadastro').value = 'Ficção';
    document.getElementById('tipoAnuncio').value = 'troca';
    const estadoLivro = document.getElementById('estadoLivro');
    if (estadoLivro) estadoLivro.value = 'usado_bom';
    fotosAnuncioAtual = [];
    renderPreviewFotosAnuncio();
    document.getElementById('precoLivro').value = '';
    document.getElementById('precoLivro').style.display = 'none';
}

function editarLivro(livro) {
    livroEditandoId = livro.id;
    document.getElementById('formTitulo').textContent = 'Editar anúncio';
    document.getElementById('btnSalvarLivro').textContent = 'Salvar alterações';
    document.getElementById('btnCancelarEdicao').style.display = 'inline-flex';

    document.getElementById('titulo').value = livro.titulo || '';
    document.getElementById('autor').value = livro.autor || '';
    document.getElementById('generoCadastro').value = livro.genero || 'Outros';
    document.getElementById('tipoAnuncio').value = getTipoSeguro(livro.tipo);
    const estadoLivro = document.getElementById('estadoLivro');
    if (estadoLivro) estadoLivro.value = getEstadoLivroSeguro(livro.estado);
    fotosAnuncioAtual = getFotosLivro(livro);
    renderPreviewFotosAnuncio();
    document.getElementById('precoLivro').value = livro.preco || '';
    togglePreco();

    document.getElementById('formSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

window.cancelarEdicao = function (limpar = true) {
    livroEditandoId = null;
    const titulo = document.getElementById('formTitulo');
    const btnSalvar = document.getElementById('btnSalvarLivro');
    const btnCancelar = document.getElementById('btnCancelarEdicao');

    if (titulo) titulo.textContent = 'Adicionar novo anúncio';
    if (btnSalvar) btnSalvar.textContent = 'Adicionar anúncio';
    if (btnCancelar) btnCancelar.style.display = 'none';
    if (limpar) limparFormularioLivro();
};

// ═══════════════════════════════════════
//  LIVROS
// ═══════════════════════════════════════
async function mostrarLivrosBase() {
    const { data: livros, error } = await _supabase
        .from('livros')
        .select('*')
        .order('id', { ascending: false });

    if (error) throw error;

    cacheLivros = livros || [];
    atualizarStats(cacheLivros);
    await carregarPerfisDosDonos(cacheLivros);
    await carregarResumoAvaliacoes(cacheLivros);
    atualizarBadgeSacola();
    return cacheLivros;
}

window.mostrarLivros = async function () {
    container.innerHTML = [1,2,3,4,5,6].map(() => '<div class="skeleton"></div>').join('');

    try {
        await mostrarLivrosBase();
    } catch (error) {
        container.innerHTML = `<div class="empty-state">
            <span class="icon">⚠️</span>
            <h3>Erro ao carregar</h3>
            <p>${escapeHTML(error.message)}</p>
        </div>`;
        return;
    }

    container.innerHTML = '';

    let lista = (abaAtual === 'explorar')
        ? cacheLivros.filter(l => l.dono !== user_id)
        : cacheLivros.filter(l => l.dono === user_id);

    const generoFiltro = document.getElementById('filtroGenero')?.value || 'Todos';
    if (generoFiltro !== 'Todos') lista = lista.filter(l => l.genero === generoFiltro);

    const tipoFiltro = document.getElementById('filtroTipo')?.value || 'Todos';
    if (tipoFiltro !== 'Todos') lista = lista.filter(l => getTipoSeguro(l.tipo) === tipoFiltro);

    const avaliacaoFiltro = document.getElementById('filtroAvaliacao')?.value || 'Todos';
    if (avaliacaoFiltro !== 'Todos') {
        lista = lista.filter(l => {
            const resumo = getResumoAvaliacao(l.id);
            if (avaliacaoFiltro === 'avaliados') return resumo.total > 0;
            if (avaliacaoFiltro === 'sem') return resumo.total === 0;
            const minimo = Number(avaliacaoFiltro || 0);
            return resumo.total > 0 && resumo.media >= minimo;
        });
    }

    const busca = normalizarTexto(termoBusca);
    if (busca) {
        lista = lista.filter(l =>
            normalizarTexto(l.titulo).includes(busca) ||
            normalizarTexto(l.autor).includes(busca)
        );
    }

    const ordenacao = document.getElementById('filtroOrdenacao')?.value || 'recentes';
    lista = ordenarLivros(lista, ordenacao);
    atualizarTituloSecao(lista.length);

    if (lista.length === 0) {
        const msg = abaAtual === 'meus'
            ? 'Você ainda não cadastrou nenhum livro.'
            : (busca || generoFiltro !== 'Todos' || tipoFiltro !== 'Todos' || (document.getElementById('filtroAvaliacao')?.value || 'Todos') !== 'Todos')
                ? 'Nenhum livro encontrado com esses filtros.'
                : 'Nenhum livro disponível no momento.';

        container.innerHTML = `<div class="empty-state">
            <span class="icon">${abaAtual === 'meus' ? '📖' : '🔍'}</span>
            <h3>${msg}</h3>
            ${abaAtual === 'meus' ? '<p>Use o formulário acima para adicionar seu primeiro livro.</p>' : '<p>Tente limpar os filtros ou volte mais tarde.</p>'}
        </div>`;
        return;
    }

    lista.forEach(l => renderCard(l));
};

function ordenarLivros(lista, ordenacao) {
    const copia = [...lista];
    if (ordenacao === 'titulo') return copia.sort((a, b) => String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR'));
    if (ordenacao === 'autor') return copia.sort((a, b) => String(a.autor || '').localeCompare(String(b.autor || ''), 'pt-BR'));
    if (ordenacao === 'menor-preco') return copia.sort((a, b) => Number(a.preco || 0) - Number(b.preco || 0));
    if (ordenacao === 'maior-preco') return copia.sort((a, b) => Number(b.preco || 0) - Number(a.preco || 0));
    return copia;
}

async function carregarPerfisDosDonos(livros) {
    const donos = [...new Set(livros.map(l => l.dono).filter(Boolean))];
    const faltando = donos.filter(id => !cachePerfis.has(id));
    if (faltando.length === 0) return;

    try {
        const { data, error } = await _supabase
            .from('profiles')
            .select('id, nome, cidade')
            .in('id', faltando);

        if (!error && data) {
            data.forEach(p => cachePerfis.set(p.id, p));
        }
    } catch (_) {
        // Se a política do Supabase bloquear profiles, o site continua funcionando sem mostrar dono/cidade.
    }
}

async function carregarResumoAvaliacoes(livros) {
    const ids = [...new Set((livros || []).map(l => l.id).filter(Boolean))];
    cacheAvaliacoesResumo = new Map();
    if (ids.length === 0) return;

    try {
        const { data, error } = await _supabase
            .from('avaliacoes_livros')
            .select('livro_id, nota')
            .in('livro_id', ids);

        if (error || !data) return;

        const grupos = new Map();
        data.forEach(av => {
            const key = String(av.livro_id);
            const atual = grupos.get(key) || { soma: 0, total: 0 };
            atual.soma += Number(av.nota || 0);
            atual.total += 1;
            grupos.set(key, atual);
        });

        grupos.forEach((v, key) => {
            cacheAvaliacoesResumo.set(key, { media: v.total ? v.soma / v.total : 0, total: v.total });
        });
    } catch (_) {
        // Se a tabela de avaliações ainda não existir, os cards seguem funcionando normalmente.
    }
}

function renderCard(l) {
    const div = document.createElement('div');
    div.className = 'livro marketplace-card';

    const tipo = getTipoSeguro(l.tipo);
    const genero = l.genero || 'Outros';
    const genreColor = GENRE_COLORS[genero] || '#9ca3af';
    const perfilDono = cachePerfis.get(l.dono);
    const temPreco = tipo !== 'troca' && Number(l.preco) > 0;
    const precoHTML = temPreco
        ? `<p class="livro-preco">${formatarPreco(l.preco)}</p>`
        : '<p class="livro-preco muted-price">Negociável por troca</p>';
    const naSacola = livroNaSacola(l.id);

    div.style.setProperty('--genre-color', genreColor);
    div.innerHTML = `
        <div class="card-topline">
            ${renderCapaLivro(l)}
            <div class="livro-badges">
                <span class="badge-genre">${escapeHTML(genero)}</span>
                <span class="badge-tipo tipo-${tipo}">${TIPO_LABELS[tipo]}</span>
                <span class="badge-estado">${escapeHTML(ESTADO_LABELS[getEstadoLivroSeguro(l.estado)])}</span>
            </div>
        </div>
        <h3 class="livro-titulo">${escapeHTML(l.titulo)}</h3>
        <p class="livro-autor">por ${escapeHTML(l.autor)}</p>
        ${renderContadorFotos(l)}
        ${renderResumoAvaliacao(l.id)}
        ${perfilDono && abaAtual === 'explorar' ? `<p class="livro-dono">👤 ${escapeHTML(perfilDono.nome || 'Leitor')} ${perfilDono.cidade ? '• ' + escapeHTML(perfilDono.cidade) : ''}</p>` : ''}
        ${precoHTML}
        <div class="livro-acoes"></div>
    `;

    const acoes = div.querySelector('.livro-acoes');

    if (abaAtual === 'explorar') {
        const linha = document.createElement('div');
        linha.className = 'acoes-stack';

        if (temPreco) {
            const btnComprar = document.createElement('button');
            btnComprar.className = 'btn-comprar';
            btnComprar.textContent = 'Comprar / enviar interesse';
            btnComprar.addEventListener('click', () => confirmarInteresse(l.id));
            linha.appendChild(btnComprar);
        }

        const linhaSecundaria = document.createElement('div');
        linhaSecundaria.className = 'acoes-duplas';

        const btnSacola = document.createElement('button');
        btnSacola.className = naSacola ? 'btn-sacola ativo-sacola' : 'btn-sacola';
        btnSacola.textContent = naSacola ? 'Na sacola' : 'Adicionar';
        btnSacola.addEventListener('click', () => naSacola ? removerDaSacola(l.id) : adicionarNaSacola(l.id));

        const btnDetalhes = document.createElement('button');
        btnDetalhes.className = 'btn-detalhes';
        btnDetalhes.textContent = 'Ver detalhes';
        btnDetalhes.addEventListener('click', () => abrirDetalhesLivro(l.id));

        const btn = document.createElement('button');
        btn.className = 'btn-negociar';
        btn.textContent = tipo === 'troca' ? 'Propor troca' : 'Negociar';
        btn.addEventListener('click', () => abrirChat(l.id, l.titulo, l.dono));

        linhaSecundaria.appendChild(btnDetalhes);
        linhaSecundaria.appendChild(btnSacola);
        linhaSecundaria.appendChild(btn);
        linha.appendChild(linhaSecundaria);
        acoes.appendChild(linha);
    } else {
        const linha = document.createElement('div');
        linha.className = 'acoes-duplas';

        const btnEditar = document.createElement('button');
        btnEditar.className = 'btn-editar';
        btnEditar.textContent = 'Editar';
        btnEditar.addEventListener('click', () => editarLivro(l));

        const btnExcluir = document.createElement('button');
        btnExcluir.className = 'btn-excluir';
        btnExcluir.textContent = 'Excluir';
        btnExcluir.addEventListener('click', () => removerLivro(l.id, btnExcluir));

        const btnDetalhes = document.createElement('button');
        btnDetalhes.className = 'btn-detalhes';
        btnDetalhes.textContent = 'Detalhes';
        btnDetalhes.addEventListener('click', () => abrirDetalhesLivro(l.id));

        linha.appendChild(btnDetalhes);
        linha.appendChild(btnEditar);
        linha.appendChild(btnExcluir);
        acoes.appendChild(linha);
    }

    container.appendChild(div);
}

// ═══════════════════════════════════════
//  SACOLA
// ═══════════════════════════════════════
function mostrarSacola() {
    container.innerHTML = '';
    const livrosSacola = getLivrosDaSacola();
    const idsAtuais = livrosSacola.map(l => String(l.id));
    if (idsAtuais.length !== getSacolaIds().length) salvarSacolaIds(idsAtuais);

    atualizarTituloSecao(livrosSacola.length);

    if (livrosSacola.length === 0) {
        container.innerHTML = `<div class="empty-state cart-empty">
            <span class="icon">🛒</span>
            <h3>Sua sacola está vazia</h3>
            <p>Adicione livros do acervo para simular uma compra ou iniciar uma negociação.</p>
            <button class="btn-primary" onclick="mudarAba('explorar', document.getElementById('btn-explorar'))">Explorar livros</button>
        </div>`;
        return;
    }

    const subtotal = livrosSacola.reduce((total, l) => total + Number(l.preco || 0), 0);

    const resumo = document.createElement('div');
    resumo.className = 'cart-summary';
    resumo.innerHTML = `
        <div>
            <span>Resumo da sacola</span>
            <strong>${livrosSacola.length} livro(s)</strong>
        </div>
        <div>
            <span>Subtotal estimado</span>
            <strong>${formatarPreco(subtotal)}</strong>
        </div>
        <button class="btn-primary" onclick="enviarPropostasSacola()">Finalizar pedido</button>
    `;
    container.appendChild(resumo);

    livrosSacola.forEach(l => renderSacolaCard(l));
}

function renderSacolaCard(l) {
    const div = document.createElement('div');
    div.className = 'livro marketplace-card cart-card';
    const tipo = getTipoSeguro(l.tipo);
    const genero = l.genero || 'Outros';
    const genreColor = GENRE_COLORS[genero] || '#9ca3af';
    const dono = cachePerfis.get(l.dono);

    div.style.setProperty('--genre-color', genreColor);
    div.innerHTML = `
        <div class="card-topline">
            ${renderCapaLivro(l)}
            <div class="livro-badges">
                <span class="badge-genre">${escapeHTML(genero)}</span>
                <span class="badge-tipo tipo-${tipo}">${TIPO_LABELS[tipo]}</span>
                <span class="badge-estado">${escapeHTML(ESTADO_LABELS[getEstadoLivroSeguro(l.estado)])}</span>
            </div>
        </div>
        <h3 class="livro-titulo">${escapeHTML(l.titulo)}</h3>
        <p class="livro-autor">por ${escapeHTML(l.autor)}</p>
        <p class="book-condition-line">Estado: ${escapeHTML(ESTADO_LABELS[getEstadoLivroSeguro(l.estado)])}</p>
        ${renderContadorFotos(l)}
        ${renderResumoAvaliacao(l.id)}
        <p class="livro-dono">Vendedor: ${escapeHTML(dono?.nome || 'Leitor')} ${dono?.cidade ? '• ' + escapeHTML(dono.cidade) : ''}</p>
        <p class="livro-preco">${tipo !== 'troca' && Number(l.preco) > 0 ? formatarPreco(l.preco) : 'Negociável por troca'}</p>
        <div class="livro-acoes">
            <div class="acoes-duplas">
                <button class="btn-detalhes" onclick="abrirDetalhesLivro('${escapeHTML(l.id)}')">Detalhes</button>
                <button class="btn-excluir" onclick="removerDaSacola('${escapeHTML(l.id)}')">Remover</button>
                <button class="btn-comprar" onclick="confirmarInteresse('${escapeHTML(l.id)}')">Finalizar</button>
            </div>
        </div>
    `;

    container.appendChild(div);
}


// ═══════════════════════════════════════
//  DETALHES DO LIVRO + AVALIAÇÕES
// ═══════════════════════════════════════
function getLivroPorId(livroId) {
    return cacheLivros.find(l => String(l.id) === String(livroId));
}

function renderGaleriaDetalhes(livro) {
    const fotos = getFotosLivro(livro).filter(fotoSegura);
    if (!fotos.length) {
        return `<div class="details-cover details-cover-empty">${escapeHTML(getIniciais(livro?.titulo))}</div>`;
    }

    return `
        <div class="details-gallery">
            <div class="details-main-photo"><img id="detalhesFotoPrincipal" src="${escapeHTML(fotos[0])}" alt="Foto do livro ${escapeHTML(livro?.titulo || '')}"></div>
            ${fotos.length > 1 ? `<div class="details-thumbs">${fotos.map((foto, i) => `<button class="${i === 0 ? 'active' : ''}" onclick="trocarFotoDetalhes('${escapeHTML(foto)}', this)"><img src="${escapeHTML(foto)}" alt="Miniatura ${i + 1}"></button>`).join('')}</div>` : ''}
        </div>
    `;
}

window.trocarFotoDetalhes = function (foto, btn) {
    const img = document.getElementById('detalhesFotoPrincipal');
    if (img) img.src = foto;
    document.querySelectorAll('.details-thumbs button').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
};

window.abrirDetalhesLivro = async function (livroId) {
    const livro = getLivroPorId(livroId);
    if (!livro) {
        toast('Livro não encontrado.', 'error');
        return;
    }

    detalhesLivroAtual = livro;
    notaSelecionadaDetalhes = 0;

    const overlay = document.getElementById('detalhesLivroOverlay');
    const conteudo = document.getElementById('detalhesLivroConteudo');
    if (!overlay || !conteudo) return;

    const tipo = getTipoSeguro(livro.tipo);
    const dono = cachePerfis.get(livro.dono);
    const temPreco = tipo !== 'troca' && Number(livro.preco) > 0;
    const donoNome = dono?.nome || 'Leitor';
    const donoCidade = dono?.cidade || 'Cidade não informada';
    const descricao = livro.descricao || 'O anunciante ainda não adicionou uma descrição detalhada para este livro.';

    overlay.style.display = 'flex';
    conteudo.innerHTML = `
        <div class="details-grid details-grid-market">
            <div>${renderGaleriaDetalhes(livro)}</div>
            <div class="details-info details-info-market">
                <span class="drawer-eyebrow">Detalhes do anúncio</span>
                <h2>${escapeHTML(livro.titulo || 'Sem título')}</h2>
                <p class="details-author">por ${escapeHTML(livro.autor || 'Autor não informado')}</p>
                <div class="details-badges">
                    <span>${escapeHTML(livro.genero || 'Outros')}</span>
                    <span>${escapeHTML(TIPO_LABELS[tipo].replace('🔄 ', '').replace('💰 ', ''))}</span>
                    <span>${escapeHTML(ESTADO_LABELS[getEstadoLivroSeguro(livro.estado)])}</span>
                </div>
                <strong class="details-price">${temPreco ? formatarPreco(livro.preco) : 'Disponível para troca'}</strong>
                <div class="seller-box">
                    <span>👤</span>
                    <div>
                        <strong>${escapeHTML(donoNome)}</strong>
                        <small>${escapeHTML(donoCidade)}</small>
                    </div>
                </div>
                <p class="details-text">${escapeHTML(descricao)}</p>
                <div class="details-rating-inline">${renderResumoAvaliacao(livro.id)}</div>
                <div class="details-actions">
                    ${livro.dono !== user_id ? `<button class="btn-primary" onclick="confirmarInteresse('${escapeHTML(livro.id)}')">Enviar interesse</button>` : ''}
                    ${livro.dono !== user_id ? `<button class="btn-ghost" onclick="adicionarNaSacola('${escapeHTML(livro.id)}')">Adicionar à sacola</button>` : ''}
                    ${livro.dono !== user_id ? `<button class="btn-ghost" onclick="abrirChat('${escapeHTML(livro.id)}', '${escapeHTML(livro.titulo || '')}', '${escapeHTML(livro.dono || '')}')">Negociar no chat</button>` : '<button class="btn-ghost" onclick="fecharDetalhesLivro(); mudarAba(\'meus\', document.getElementById(\'btn-meus\'))">Editar em meus anúncios</button>'}
                </div>
            </div>
        </div>
        <section class="reviews-section">
            <div class="reviews-title-row">
                <div>
                    <span class="drawer-eyebrow">Avaliações</span>
                    <h3>Comentários de leitores</h3>
                </div>
                <strong id="detalhesResumoAvaliacao">${renderResumoAvaliacao(livro.id)}</strong>
            </div>
            <div id="reviewFormBox" class="review-form-box">
                <span>Sua avaliação</span>
                <div id="reviewStars" class="review-stars">
                    ${[1,2,3,4,5].map(n => `<button onclick="selecionarNotaDetalhes(${n})" title="${n} estrela(s)">☆</button>`).join('')}
                </div>
                <textarea id="reviewComentario" maxlength="500" placeholder="Escreva um comentário curto sobre o livro ou sobre o anúncio..."></textarea>
                <button class="btn-primary" onclick="salvarAvaliacaoLivro()">Salvar avaliação</button>
            </div>
            <div id="reviewsLista" class="reviews-list"><p class="drawer-empty">Carregando avaliações...</p></div>
        </section>
    `;

    await carregarAvaliacoesLivro(livro.id);
};

window.fecharDetalhesLivro = function () {
    const overlay = document.getElementById('detalhesLivroOverlay');
    if (overlay) overlay.style.display = 'none';
    detalhesLivroAtual = null;
    notaSelecionadaDetalhes = 0;
};

window.selecionarNotaDetalhes = function (nota) {
    notaSelecionadaDetalhes = Math.max(1, Math.min(5, Number(nota) || 0));
    document.querySelectorAll('#reviewStars button').forEach((btn, index) => {
        btn.textContent = index < notaSelecionadaDetalhes ? '★' : '☆';
        btn.classList.toggle('active', index < notaSelecionadaDetalhes);
    });
};

async function carregarAvaliacoesLivro(livroId) {
    const lista = document.getElementById('reviewsLista');
    if (!lista) return;

    try {
        const { data, error } = await _supabase
            .from('avaliacoes_livros')
            .select('*')
            .eq('livro_id', livroId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const avaliacoes = data || [];
        const userIds = [...new Set(avaliacoes.map(a => a.user_id).filter(Boolean))];
        if (userIds.length > 0) {
            const faltando = userIds.filter(id => !cachePerfis.has(id));
            if (faltando.length > 0) {
                const { data: perfis } = await _supabase.from('profiles').select('id, nome, cidade').in('id', faltando);
                (perfis || []).forEach(p => cachePerfis.set(p.id, p));
            }
        }

        atualizarResumoAvaliacoesLocal(livroId, avaliacoes);
        renderAvaliacoesLivro(avaliacoes);

        const minha = avaliacoes.find(a => a.user_id === user_id);
        if (minha) {
            selecionarNotaDetalhes(minha.nota);
            const textarea = document.getElementById('reviewComentario');
            if (textarea) textarea.value = minha.comentario || '';
        }
    } catch (err) {
        lista.innerHTML = `<p class="drawer-empty">Não foi possível carregar avaliações. Rode o SQL atualizado no Supabase.</p>`;
    }
}

function atualizarResumoAvaliacoesLocal(livroId, avaliacoes) {
    const total = avaliacoes.length;
    const media = total ? avaliacoes.reduce((s, a) => s + Number(a.nota || 0), 0) / total : 0;
    cacheAvaliacoesResumo.set(String(livroId), { media, total });
    const resumo = document.getElementById('detalhesResumoAvaliacao');
    if (resumo) resumo.innerHTML = renderResumoAvaliacao(livroId);
}

function renderAvaliacoesLivro(avaliacoes) {
    const lista = document.getElementById('reviewsLista');
    if (!lista) return;

    if (!avaliacoes.length) {
        lista.innerHTML = '<p class="drawer-empty">Ainda não há avaliações para este livro.</p>';
        return;
    }

    lista.innerHTML = avaliacoes.map(av => {
        const perfil = cachePerfis.get(av.user_id);
        const podeExcluir = av.user_id === user_id;
        return `
            <article class="review-card">
                <div class="review-head">
                    <div>
                        <strong>${escapeHTML(perfil?.nome || 'Leitor')}</strong>
                        <span>${renderRatingStars(av.nota)} • ${new Date(av.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                    ${podeExcluir ? `<button onclick="excluirAvaliacaoLivro('${escapeHTML(av.id)}')">Excluir</button>` : ''}
                </div>
                <p>${escapeHTML(av.comentario || 'Sem comentário escrito.')}</p>
            </article>
        `;
    }).join('');
}

window.salvarAvaliacaoLivro = async function () {
    if (!detalhesLivroAtual) return;
    if (!notaSelecionadaDetalhes) {
        toast('Selecione uma nota de 1 a 5 estrelas.', 'error');
        return;
    }

    const comentario = document.getElementById('reviewComentario')?.value.trim() || '';

    try {
        const { error } = await _supabase
            .from('avaliacoes_livros')
            .upsert({
                livro_id: detalhesLivroAtual.id,
                user_id,
                nota: notaSelecionadaDetalhes,
                comentario,
            }, { onConflict: 'livro_id,user_id' });

        if (error) throw error;
        toast('Avaliação salva com sucesso!');
        await carregarAvaliacoesLivro(detalhesLivroAtual.id);
        if (abaAtual === 'explorar' || abaAtual === 'sacola') mostrarLivrosBase();
    } catch (err) {
        toast('Erro ao salvar avaliação: ' + err.message, 'error');
    }
};

window.excluirAvaliacaoLivro = async function (avaliacaoId) {
    if (!confirm('Remover sua avaliação?')) return;
    try {
        const { error } = await _supabase.from('avaliacoes_livros').delete().eq('id', avaliacaoId).eq('user_id', user_id);
        if (error) throw error;
        toast('Avaliação removida.', 'info');
        if (detalhesLivroAtual) await carregarAvaliacoesLivro(detalhesLivroAtual.id);
    } catch (err) {
        toast('Erro ao remover avaliação: ' + err.message, 'error');
    }
};

// ═══════════════════════════════════════
//  PROPOSTAS
// ═══════════════════════════════════════
async function mostrarInteresses() {
    container.innerHTML = '<div class="empty-state"><span class="icon">⏳</span><h3>Buscando propostas...</h3></div>';

    const { data: meusLivros, error: livrosError } = await _supabase
        .from('livros')
        .select('id, titulo')
        .eq('dono', user_id);

    if (livrosError) {
        container.innerHTML = `<div class="empty-state"><span class="icon">⚠️</span><h3>Erro ao buscar propostas</h3><p>${escapeHTML(livrosError.message)}</p></div>`;
        atualizarTituloSecao(0);
        return;
    }

    if (!meusLivros || meusLivros.length === 0) {
        container.innerHTML = `<div class="empty-state">
            <span class="icon">📭</span>
            <h3>Ainda sem propostas</h3>
            <p>Cadastre livros para receber propostas de outros leitores.</p>
        </div>`;
        atualizarTituloSecao(0);
        return;
    }

    const ids = meusLivros.map(l => l.id);
    const { data: mensagens, error } = await _supabase
        .from('mensagens')
        .select('*')
        .in('livro_id', ids)
        .eq('receiver_id', user_id)
        .order('created_at', { ascending: false });

    container.innerHTML = '';

    if (error) {
        container.innerHTML = `<div class="empty-state"><span class="icon">⚠️</span><h3>Erro ao carregar mensagens</h3><p>${escapeHTML(error.message)}</p></div>`;
        atualizarTituloSecao(0);
        return;
    }

    if (!mensagens || mensagens.length === 0) {
        container.innerHTML = `<div class="empty-state">
            <span class="icon">💬</span>
            <h3>Nenhuma proposta recebida ainda</h3>
            <p>Quando alguém se interessar pelos seus livros, aparecerá aqui.</p>
        </div>`;
        atualizarTituloSecao(0);
        return;
    }

    const conversasUnicas = new Map();
    mensagens.forEach(m => {
        const chave = `${m.livro_id}-${m.sender_id}`;
        if (!conversasUnicas.has(chave)) conversasUnicas.set(chave, m);
    });

    atualizarTituloSecao(conversasUnicas.size);

    conversasUnicas.forEach(m => {
        const livro = meusLivros.find(l => String(l.id) === String(m.livro_id));
        if (!livro) return;

        const div = document.createElement('div');
        div.className = 'livro proposta-card';
        div.style.setProperty('--genre-color', '#86efac');
        div.innerHTML = `
            <div class="livro-badges">
                <span class="badge-tipo tipo-troca">💬 Proposta recebida</span>
            </div>
            <h3 class="livro-titulo">${escapeHTML(livro.titulo)}</h3>
            <p class="livro-autor">Interessado: <strong>${escapeHTML(m.sender_nome || 'Usuário')}</strong></p>
            <p class="livro-dono">Última mensagem: ${new Date(m.created_at).toLocaleDateString('pt-BR')}</p>
            <p class="mensagem-preview">“${escapeHTML(m.texto || '').slice(0, 110)}${String(m.texto || '').length > 110 ? '...' : ''}”</p>
            <div class="livro-acoes"></div>
        `;

        const btn = document.createElement('button');
        btn.className = 'btn-negociar';
        btn.textContent = '💬 Abrir Chat';
        btn.addEventListener('click', () => abrirChat(m.livro_id, livro.titulo, m.sender_id));
        div.querySelector('.livro-acoes').appendChild(btn);

        container.appendChild(div);
    });
}

// ═══════════════════════════════════════
//  CHAT
// ═══════════════════════════════════════
window.abrirChat = async function (livroId, titulo, outroUsuarioId) {
    chatAtivoId = livroId;
    chatDestinatarioId = outroUsuarioId;

    document.getElementById('chatContainer').style.display = 'flex';
    document.getElementById('chatTitulo').textContent = titulo || 'Negociação';
    const chatStatus = document.getElementById('chatStatus');
    if (chatStatus) chatStatus.textContent = 'Negociação aberta com outro leitor';

    const box = document.getElementById('chatMensagens');
    box.innerHTML = '<p class="chat-placeholder">Carregando...</p>';

    try {
        const { data: historico, error } = await _supabase
            .from('mensagens')
            .select('*')
            .eq('livro_id', chatAtivoId)
            .or(`and(sender_id.eq.${user_id},receiver_id.eq.${chatDestinatarioId}),and(sender_id.eq.${chatDestinatarioId},receiver_id.eq.${user_id})`)
            .order('created_at', { ascending: true });

        if (error) throw error;

        box.innerHTML = '';
        if (historico && historico.length > 0) {
            historico.forEach(m => adicionarMensagemNaTela(m));
        } else {
            box.innerHTML = '<p class="chat-placeholder">Inicie a negociação! 👋</p>';
        }
    } catch (err) {
        box.innerHTML = '<p class="chat-placeholder erro">Erro ao carregar mensagens.</p>';
    }

    if (canalMensagens) await _supabase.removeChannel(canalMensagens);

    canalMensagens = _supabase.channel(`chat_${chatAtivoId}_${user_id}`);
    canalMensagens.on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'mensagens',
        filter: `livro_id=eq.${chatAtivoId}`,
    }, (payload) => {
        const m = payload.new;
        if (
            (m.sender_id === user_id && m.receiver_id === chatDestinatarioId) ||
            (m.sender_id === chatDestinatarioId && m.receiver_id === user_id)
        ) {
            adicionarMensagemNaTela(m);
        }
    }).subscribe();
};


window.preencherMensagemRapida = function (texto) {
    const input = document.getElementById('novaMensagem');
    if (!input) return;
    input.value = texto;
    input.focus();
};

window.enviarMensagem = async function () {
    const input = document.getElementById('novaMensagem');
    const btn = document.getElementById('btnEnviarMensagem');
    const texto = input.value.trim();
    if (!texto || !chatAtivoId || !chatDestinatarioId) return;

    btn.disabled = true;

    const { data, error } = await _supabase.from('mensagens').insert([{
        livro_id: chatAtivoId,
        sender_id: user_id,
        receiver_id: chatDestinatarioId,
        sender_nome: user_nome,
        texto,
    }]).select().single();

    btn.disabled = false;

    if (error) {
        toast('Erro ao enviar mensagem.', 'error');
        return;
    }

    input.value = '';
    if (data) adicionarMensagemNaTela(data);
};

function adicionarMensagemNaTela(msg) {
    const box = document.getElementById('chatMensagens');
    if (document.getElementById(`msg-${msg.id}`)) return;

    const placeholder = box.querySelector('.chat-placeholder');
    if (placeholder) placeholder.remove();

    const div = document.createElement('div');
    div.id = `msg-${msg.id}`;
    const souEu = msg.sender_id === user_id;
    div.className = `msg ${souEu ? 'eu' : 'outro'}`;
    div.innerHTML = `
        <small>${souEu ? 'Você' : escapeHTML(msg.sender_nome || 'Usuário')}</small>
        <span>${escapeHTML(msg.texto)}</span>
    `;

    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

window.fecharChat = function () {
    document.getElementById('chatContainer').style.display = 'none';
    if (canalMensagens) {
        _supabase.removeChannel(canalMensagens);
        canalMensagens = null;
    }
};



// ═══════════════════════════════════════
//  PERFIL LATERAL + METAS DE LEITURA
// ═══════════════════════════════════════
function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function setBarWidth(id, value) {
    const el = document.getElementById(id);
    if (el) el.style.width = `${Math.max(0, Math.min(100, Number(value) || 0))}%`;
}

function inicioDoDiaISO() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
}

function inicioDoMesISO() {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
}


function aplicarAvatarUsuario(elementId, nome, fotoUrl) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (fotoUrl) {
        el.textContent = '';
        el.style.backgroundImage = `url("${fotoUrl}")`;
        el.classList.add('has-photo');
    } else {
        el.style.backgroundImage = '';
        el.classList.remove('has-photo');
        el.textContent = getIniciais(nome || 'Usuário');
    }
}

function getStatusBibliotecaSeguro(status) {
    return ['quero_ler', 'lendo', 'lido'].includes(status) ? status : 'quero_ler';
}

function labelStatusBiblioteca(status) {
    return {
        quero_ler: 'Quero ler',
        lendo: 'Lendo',
        lido: 'Lido',
    }[getStatusBibliotecaSeguro(status)];
}

function limparErroLeitura() {
    const el = document.getElementById('drawerReadingError');
    if (el) {
        el.style.display = 'none';
        el.innerHTML = '';
    }
}

function mostrarErroLeitura(error) {
    const el = document.getElementById('drawerReadingError');
    const lista = document.getElementById('drawerBibliotecaLista');
    if (lista) lista.innerHTML = '<p class="drawer-empty">Não foi possível carregar a biblioteca de leitura.</p>';
    const listaMain = document.getElementById('bibliotecaListaMain');
    if (listaMain) listaMain.innerHTML = '<p class="drawer-empty">Não foi possível carregar a biblioteca de leitura.</p>';
    if (!el) return;
    el.style.display = 'block';
    el.innerHTML = `
        <strong>Biblioteca ainda não configurada</strong>
        <span>Crie as tabelas do arquivo <b>supabase-metas-leitura.sql</b> no Supabase e atualize a página.</span>
        <small>${escapeHTML(error?.message || 'Erro ao acessar as tabelas de leitura.')}</small>
    `;
}

window.abrirPerfilLateral = async function () {
    const drawer = document.getElementById('perfilDrawer');
    const overlay = document.getElementById('perfilOverlay');
    if (overlay) overlay.style.display = 'block';
    if (drawer) {
        drawer.classList.add('open');
        drawer.setAttribute('aria-hidden', 'false');
    }

    setText('drawerUserName', user_nome || 'Usuário');
    setText('drawerUserCity', perfilUsuarioAtual?.cidade ? perfilUsuarioAtual.cidade : 'Cidade não informada');
    aplicarAvatarUsuario('drawerAvatar', user_nome, perfilUsuarioAtual?.foto_url);

    await carregarPainelLeitura();
};

window.fecharPerfilLateral = function () {
    const drawer = document.getElementById('perfilDrawer');
    const overlay = document.getElementById('perfilOverlay');
    if (drawer) {
        drawer.classList.remove('open');
        drawer.setAttribute('aria-hidden', 'true');
    }
    if (overlay) overlay.style.display = 'none';
};

async function garantirMetaLeitura() {
    const { data, error } = await _supabase
        .from('metas_leitura')
        .select('*')
        .eq('user_id', user_id)
        .maybeSingle();

    if (error) throw error;
    if (data) return data;

    const { data: criada, error: insertError } = await _supabase
        .from('metas_leitura')
        .insert([{ user_id, meta_diaria_paginas: 20, meta_mensal_livros: 1 }])
        .select('*')
        .single();

    if (insertError) throw insertError;
    return criada;
}

window.carregarPainelLeitura = async function () {
    limparErroLeitura();
    const lista = document.getElementById('drawerBibliotecaLista');
    if (lista) lista.innerHTML = '<p class="drawer-empty">Carregando biblioteca...</p>';

    try {
        const [meta, bibliotecaResp, registrosResp] = await Promise.all([
            garantirMetaLeitura(),
            _supabase
                .from('biblioteca_usuario')
                .select('*')
                .eq('user_id', user_id)
                .order('updated_at', { ascending: false }),
            _supabase
                .from('registros_leitura')
                .select('paginas_lidas, created_at')
                .eq('user_id', user_id)
                .gte('created_at', inicioDoDiaISO()),
        ]);

        if (bibliotecaResp.error) throw bibliotecaResp.error;
        if (registrosResp.error) throw registrosResp.error;

        metaLeituraAtual = meta;
        cacheBiblioteca = bibliotecaResp.data || [];
        renderPainelLeitura(registrosResp.data || []);
    } catch (error) {
        mostrarErroLeitura(error);
    }
};

function renderPainelLeitura(registrosHoje = []) {
    const metaDiaria = Number(metaLeituraAtual?.meta_diaria_paginas || 20);
    const metaMensal = Number(metaLeituraAtual?.meta_mensal_livros || 1);
    const paginasHoje = registrosHoje.reduce((total, r) => total + Number(r.paginas_lidas || 0), 0);

    const queroLer = cacheBiblioteca.filter(l => getStatusBibliotecaSeguro(l.status) === 'quero_ler').length;
    const lendo = cacheBiblioteca.filter(l => getStatusBibliotecaSeguro(l.status) === 'lendo').length;
    const lidos = cacheBiblioteca.filter(l => getStatusBibliotecaSeguro(l.status) === 'lido').length;
    const lidosMes = cacheBiblioteca.filter(l => {
        if (getStatusBibliotecaSeguro(l.status) !== 'lido') return false;
        return !l.concluido_em || new Date(l.concluido_em) >= new Date(inicioDoMesISO());
    }).length;

    setText('drawerStatQueroLer', queroLer);
    setText('drawerStatLendo', lendo);
    setText('drawerStatLidos', lidos);
    setText('drawerStatPaginas', paginasHoje);
    setText('mainStatQueroLer', queroLer);
    setText('mainStatLendo', lendo);
    setText('mainStatLidos', lidos);
    setText('mainStatPaginas', paginasHoje);
    setText('metaDiariaTexto', `${paginasHoje} de ${metaDiaria} páginas hoje`);
    setText('metaMensalTexto', `${lidosMes} de ${metaMensal} livro${metaMensal === 1 ? '' : 's'} no mês`);
    setText('mainMetaDiariaTexto', `${paginasHoje} de ${metaDiaria} páginas hoje`);
    setText('mainMetaMensalTexto', `${lidosMes} de ${metaMensal} livro${metaMensal === 1 ? '' : 's'} no mês`);

    const pctDia = metaDiaria > 0 ? (paginasHoje / metaDiaria) * 100 : 0;
    const pctMes = metaMensal > 0 ? (lidosMes / metaMensal) * 100 : 0;
    setText('metaDiariaPct', `${Math.min(100, Math.round(pctDia))}%`);
    setText('metaMensalPct', `${Math.min(100, Math.round(pctMes))}%`);
    setText('mainMetaDiariaPct', `${Math.min(100, Math.round(pctDia))}%`);
    setText('mainMetaMensalPct', `${Math.min(100, Math.round(pctMes))}%`);
    setBarWidth('metaDiariaBarra', pctDia);
    setBarWidth('metaMensalBarra', pctMes);
    setBarWidth('mainMetaDiariaBarra', pctDia);
    setBarWidth('mainMetaMensalBarra', pctMes);

    const inputDiaria = document.getElementById('metaDiariaInput');
    const inputMensal = document.getElementById('metaMensalInput');
    const inputDiariaMain = document.getElementById('metaDiariaInputMain');
    const inputMensalMain = document.getElementById('metaMensalInputMain');
    if (inputDiaria) inputDiaria.value = metaDiaria;
    if (inputMensal) inputMensal.value = metaMensal;
    if (inputDiariaMain) inputDiariaMain.value = metaDiaria;
    if (inputMensalMain) inputMensalMain.value = metaMensal;

    const lendoAgora = cacheBiblioteca.find(l => getStatusBibliotecaSeguro(l.status) === 'lendo') || cacheBiblioteca[0];
    livroAtualLeituraId = lendoAgora?.id || null;

    const btnAtual = document.getElementById('btnRegistrarLeituraAtual');
    if (!lendoAgora) {
        setText('drawerLivroAtualTitulo', 'Nenhum livro em andamento');
        setText('drawerLivroAtualAutor', 'Adicione um livro à sua biblioteca para acompanhar sua evolução.');
        setText('drawerLivroAtualPaginas', '0 de 0 páginas');
        setText('drawerLivroAtualPercentual', '0%');
        setText('mainLivroAtualTitulo', 'Nenhum livro em andamento');
        setText('mainLivroAtualAutor', 'Adicione um livro à sua biblioteca para acompanhar sua evolução.');
        setText('mainLivroAtualPaginas', '0 de 0 páginas');
        setText('mainLivroAtualPercentual', '0%');
        setBarWidth('drawerLivroAtualBarra', 0);
        setBarWidth('mainLivroAtualBarra', 0);
        if (btnAtual) btnAtual.disabled = true;
        const btnMain = document.getElementById('btnRegistrarLeituraMain');
        if (btnMain) btnMain.disabled = true;
    } else {
        const total = Math.max(1, Number(lendoAgora.total_paginas || 1));
        const atual = Math.min(total, Number(lendoAgora.pagina_atual || 0));
        const pct = (atual / total) * 100;
        setText('drawerLivroAtualTitulo', lendoAgora.titulo || 'Livro sem título');
        setText('drawerLivroAtualAutor', lendoAgora.autor ? `por ${lendoAgora.autor}` : 'Autor não informado');
        setText('drawerLivroAtualPaginas', `${atual} de ${total} páginas`);
        setText('drawerLivroAtualPercentual', `${Math.round(pct)}%`);
        setText('mainLivroAtualTitulo', lendoAgora.titulo || 'Livro sem título');
        setText('mainLivroAtualAutor', lendoAgora.autor ? `por ${lendoAgora.autor}` : 'Autor não informado');
        setText('mainLivroAtualPaginas', `${atual} de ${total} páginas`);
        setText('mainLivroAtualPercentual', `${Math.round(pct)}%`);
        setBarWidth('drawerLivroAtualBarra', pct);
        setBarWidth('mainLivroAtualBarra', pct);
        if (btnAtual) btnAtual.disabled = getStatusBibliotecaSeguro(lendoAgora.status) === 'lido';
        const btnMain = document.getElementById('btnRegistrarLeituraMain');
        if (btnMain) btnMain.disabled = getStatusBibliotecaSeguro(lendoAgora.status) === 'lido';
    }

    renderListaBiblioteca();
    renderListaBibliotecaPrincipal();
}

function renderListaBiblioteca() {
    const lista = document.getElementById('drawerBibliotecaLista');
    if (!lista) return;

    if (cacheBiblioteca.length === 0) {
        lista.innerHTML = `
            <div class="drawer-empty rich-empty">
                <span>📚</span>
                <strong>Sua biblioteca está vazia</strong>
                <p>Adicione um livro para acompanhar metas de leitura, páginas e progresso.</p>
            </div>`;
        return;
    }

    const statusOrdem = ['lendo', 'quero_ler', 'lido'];
    lista.innerHTML = statusOrdem.map(status => {
        const livros = cacheBiblioteca.filter(l => getStatusBibliotecaSeguro(l.status) === status);
        if (livros.length === 0) return '';
        return `
            <div class="library-status-block">
                <h4>${labelStatusBiblioteca(status)} <span>${livros.length}</span></h4>
                ${livros.map(renderBibliotecaCard).join('')}
            </div>`;
    }).join('');
}

function renderListaBibliotecaPrincipal() {
    const lista = document.getElementById('bibliotecaListaMain');
    if (!lista) return;

    if (cacheBiblioteca.length === 0) {
        lista.innerHTML = `
            <div class="drawer-empty rich-empty">
                <span>📚</span>
                <strong>Sua biblioteca está vazia</strong>
                <p>Adicione um livro para acompanhar metas de leitura, páginas e progresso.</p>
            </div>`;
        return;
    }

    const statusOrdem = ['lendo', 'quero_ler', 'lido'];
    lista.innerHTML = statusOrdem.map(status => {
        const livros = cacheBiblioteca.filter(l => getStatusBibliotecaSeguro(l.status) === status);
        if (livros.length === 0) return '';
        return `
            <div class="library-status-block main-library-status">
                <h4>${labelStatusBiblioteca(status)} <span>${livros.length}</span></h4>
                ${livros.map(renderBibliotecaCard).join('')}
            </div>`;
    }).join('');
}

function renderBibliotecaCard(livro) {
    const total = Math.max(1, Number(livro.total_paginas || 1));
    const atual = Math.min(total, Number(livro.pagina_atual || 0));
    const pct = Math.round((atual / total) * 100);
    const status = getStatusBibliotecaSeguro(livro.status);

    return `
        <article class="library-mini-card">
            <div class="library-mini-cover">${escapeHTML(getIniciais(livro.titulo))}</div>
            <div class="library-mini-body">
                <div class="library-card-title-row">
                    <strong>${escapeHTML(livro.titulo || 'Livro sem título')}</strong>
                    <span>${pct}%</span>
                </div>
                <small>${escapeHTML(livro.autor || 'Autor não informado')}</small>
                <div class="progress-track compact"><div class="progress-fill" style="width:${pct}%"></div></div>
                <p>${atual} de ${total} páginas</p>
                <div class="library-card-actions">
                    ${status !== 'lido' ? `<button onclick="registrarLeituraBiblioteca('${escapeHTML(livro.id)}')">Registrar</button>` : ''}
                    ${status !== 'lendo' ? `<button onclick="alterarStatusBiblioteca('${escapeHTML(livro.id)}', 'lendo')">Lendo</button>` : ''}
                    ${status !== 'lido' ? `<button onclick="alterarStatusBiblioteca('${escapeHTML(livro.id)}', 'lido')">Concluir</button>` : ''}
                    <button onclick="editarLivroBiblioteca('${escapeHTML(livro.id)}')">Editar</button>
                    <button class="danger-mini" onclick="removerLivroBiblioteca('${escapeHTML(livro.id)}')">Excluir</button>
                </div>
            </div>
        </article>`;
}

window.salvarMetasLeitura = async function () {
    const diariaValor = (abaAtual === 'biblioteca' ? document.getElementById('metaDiariaInputMain')?.value : document.getElementById('metaDiariaInput')?.value) || document.getElementById('metaDiariaInputMain')?.value || document.getElementById('metaDiariaInput')?.value || '20';
    const mensalValor = (abaAtual === 'biblioteca' ? document.getElementById('metaMensalInputMain')?.value : document.getElementById('metaMensalInput')?.value) || document.getElementById('metaMensalInputMain')?.value || document.getElementById('metaMensalInput')?.value || '1';
    const diaria = parseInt(diariaValor, 10);
    const mensal = parseInt(mensalValor, 10);

    if (!diaria || diaria < 1 || !mensal || mensal < 1) {
        toast('Informe metas maiores que zero.', 'error');
        return;
    }

    try {
        const { error } = await _supabase
            .from('metas_leitura')
            .upsert({ user_id, meta_diaria_paginas: diaria, meta_mensal_livros: mensal, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
        if (error) throw error;
        toast('Metas salvas!');
        await carregarPainelLeitura();
    } catch (error) {
        mostrarErroLeitura(error);
    }
};

window.abrirModalBiblioteca = function (livroId = null) {
    livroBibliotecaEditandoId = livroId;
    const livro = livroId ? cacheBiblioteca.find(l => String(l.id) === String(livroId)) : null;
    const modal = document.getElementById('bibliotecaModal');
    if (modal) modal.style.display = 'flex';

    setText('modalBibliotecaTitulo', livro ? 'Editar livro' : 'Novo livro');
    const btn = document.getElementById('btnSalvarBiblioteca');
    if (btn) btn.textContent = livro ? 'Salvar alterações' : 'Adicionar';

    document.getElementById('bibliotecaTitulo').value = livro?.titulo || '';
    document.getElementById('bibliotecaAutor').value = livro?.autor || '';
    document.getElementById('bibliotecaTotalPaginas').value = livro?.total_paginas || '';
    document.getElementById('bibliotecaPaginaAtual').value = livro?.pagina_atual || '';

    const status = getStatusBibliotecaSeguro(livro?.status || 'quero_ler');
    document.querySelectorAll('.status-option').forEach(btnStatus => {
        btnStatus.classList.toggle('active', btnStatus.dataset.status === status);
    });
};

window.fecharModalBiblioteca = function () {
    const modal = document.getElementById('bibliotecaModal');
    if (modal) modal.style.display = 'none';
    livroBibliotecaEditandoId = null;
};

window.selecionarStatusBiblioteca = function (btn) {
    document.querySelectorAll('.status-option').forEach(item => item.classList.remove('active'));
    btn.classList.add('active');
};

window.salvarLivroBiblioteca = async function () {
    const titulo = document.getElementById('bibliotecaTitulo').value.trim();
    const autor = document.getElementById('bibliotecaAutor').value.trim();
    const total = parseInt(document.getElementById('bibliotecaTotalPaginas').value || '0', 10);
    let atual = parseInt(document.getElementById('bibliotecaPaginaAtual').value || '0', 10);
    const status = document.querySelector('.status-option.active')?.dataset.status || 'quero_ler';

    if (!titulo || !total || total < 1) {
        toast('Informe título e total de páginas.', 'error');
        return;
    }

    atual = Math.max(0, Math.min(total, atual));
    const statusSeguro = getStatusBibliotecaSeguro(status);
    const dados = {
        user_id,
        titulo,
        autor,
        total_paginas: total,
        pagina_atual: statusSeguro === 'lido' ? total : atual,
        status: statusSeguro,
        updated_at: new Date().toISOString(),
        concluido_em: statusSeguro === 'lido' ? new Date().toISOString() : null,
    };

    const btn = document.getElementById('btnSalvarBiblioteca');
    if (btn) btn.disabled = true;

    try {
        const operacao = livroBibliotecaEditandoId
            ? _supabase.from('biblioteca_usuario').update(dados).eq('id', livroBibliotecaEditandoId).eq('user_id', user_id)
            : _supabase.from('biblioteca_usuario').insert([dados]);
        const { error } = await operacao;
        if (error) throw error;
        toast(livroBibliotecaEditandoId ? 'Livro atualizado!' : 'Livro adicionado à biblioteca!');
        fecharModalBiblioteca();
        await carregarPainelLeitura();
    } catch (error) {
        toast('Erro ao salvar livro: ' + error.message, 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
};

window.editarLivroBiblioteca = function (id) {
    abrirModalBiblioteca(id);
};

window.registrarLeituraLivroAtual = function () {
    if (livroAtualLeituraId) registrarLeituraBiblioteca(livroAtualLeituraId);
};

window.registrarLeituraBiblioteca = async function (id) {
    const livro = cacheBiblioteca.find(l => String(l.id) === String(id));
    if (!livro) return;

    const paginas = parseInt(prompt(`Quantas páginas você leu de "${livro.titulo}"?`, '10') || '0', 10);
    if (!paginas || paginas < 1) return;

    const total = Math.max(1, Number(livro.total_paginas || 1));
    const atual = Math.min(total, Number(livro.pagina_atual || 0) + paginas);
    const concluiu = atual >= total;

    try {
        const { error: registroError } = await _supabase.from('registros_leitura').insert([{
            user_id,
            biblioteca_id: livro.id,
            paginas_lidas: paginas,
        }]);
        if (registroError) throw registroError;

        const { error: livroError } = await _supabase
            .from('biblioteca_usuario')
            .update({
                pagina_atual: atual,
                status: concluiu ? 'lido' : 'lendo',
                updated_at: new Date().toISOString(),
                concluido_em: concluiu ? new Date().toISOString() : livro.concluido_em,
            })
            .eq('id', livro.id)
            .eq('user_id', user_id);
        if (livroError) throw livroError;

        toast(concluiu ? 'Livro concluído! 🎉' : 'Leitura registrada!');
        await carregarPainelLeitura();
    } catch (error) {
        toast('Erro ao registrar leitura: ' + error.message, 'error');
    }
};

window.alterarStatusBiblioteca = async function (id, novoStatus) {
    const livro = cacheBiblioteca.find(l => String(l.id) === String(id));
    if (!livro) return;

    const status = getStatusBibliotecaSeguro(novoStatus);
    const update = {
        status,
        updated_at: new Date().toISOString(),
        concluido_em: status === 'lido' ? new Date().toISOString() : null,
    };
    if (status === 'lido') update.pagina_atual = livro.total_paginas;
    if (status === 'lendo' && Number(livro.pagina_atual || 0) >= Number(livro.total_paginas || 0)) update.pagina_atual = 0;

    try {
        const { error } = await _supabase
            .from('biblioteca_usuario')
            .update(update)
            .eq('id', id)
            .eq('user_id', user_id);
        if (error) throw error;
        toast('Status atualizado.');
        await carregarPainelLeitura();
    } catch (error) {
        toast('Erro ao atualizar status: ' + error.message, 'error');
    }
};

window.removerLivroBiblioteca = async function (id) {
    if (!confirm('Remover este livro da sua biblioteca pessoal?')) return;
    try {
        const { error } = await _supabase
            .from('biblioteca_usuario')
            .delete()
            .eq('id', id)
            .eq('user_id', user_id);
        if (error) throw error;
        toast('Livro removido da biblioteca.');
        await carregarPainelLeitura();
    } catch (error) {
        toast('Erro ao remover livro: ' + error.message, 'error');
    }
};

// ═══════════════════════════════════════
//  REMOVER / LOGOUT
// ═══════════════════════════════════════
window.removerLivro = async function (id, btn) {
    if (!confirm('Tem certeza que deseja excluir este livro?')) return;
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Excluindo...';
    }

    const { error } = await _supabase.from('livros').delete().eq('id', id).eq('dono', user_id);

    if (error) {
        toast('Erro ao excluir: ' + error.message, 'error');
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Excluir';
        }
    } else {
        toast('Livro removido.');
        removerDaSacola(id);
        if (String(livroEditandoId) === String(id)) cancelarEdicao();
        mostrarLivros();
    }
};

window.logout = async function () {
    await _supabase.auth.signOut();
    localStorage.removeItem('usuario');
    window.location.href = 'login.html';
};

inicializar();
