let adminLivros = [];
let adminPerfis = [];
let adminMensagens = [];
let adminAvaliacoes = [];
let adminPedidos = [];

const TIPO_LABELS_ADMIN = {
    troca: 'Troca',
    venda: 'Venda',
    ambos: 'Venda ou troca',
};

const ESTADO_LABELS_ADMIN = {
    novo: 'Novo',
    seminovo: 'Seminovo',
    usado_bom: 'Usado em bom estado',
    usado_marcado: 'Usado com marcas',
    danificado: 'Com avarias',
};

const PEDIDO_STATUS_LABELS = {
    aberto: 'Aberto',
    em_negociacao: 'Em negociação',
    concluido: 'Concluído',
    cancelado: 'Cancelado',
};

function getStatusPedidoSeguro(status) {
    return Object.keys(PEDIDO_STATUS_LABELS).includes(status) ? status : 'aberto';
}

function getEstadoLivroSeguro(estado) {
    return Object.keys(ESTADO_LABELS_ADMIN).includes(estado) ? estado : 'usado_bom';
}

function getFotosLivro(livro) {
    const fotos = livro?.fotos;
    if (Array.isArray(fotos)) return fotos.filter(Boolean);
    if (typeof fotos === 'string' && fotos.trim()) {
        try {
            const parsed = JSON.parse(fotos);
            if (Array.isArray(parsed)) return parsed.filter(Boolean);
        } catch (_) { return [fotos]; }
    }
    return [];
}


function fotoSegura(src) {
    return typeof src === 'string' && (src.startsWith('data:image/') || src.startsWith('https://') || src.startsWith('http://'));
}

function getIniciais(valor) {
    return String(valor || 'Livro').trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '📚';
}

function renderAdminCover(livro) {
    const foto = getFotosLivro(livro).find(fotoSegura);
    if (foto) return `<div class="admin-cover admin-cover-photo"><img src="${escapeHTML(foto)}" alt="Foto de ${escapeHTML(livro?.titulo || '')}"></div>`;
    return `<div class="admin-cover">${escapeHTML(getIniciais(livro?.titulo))}</div>`;
}

function renderStars(nota = 0) {
    const n = Math.round(Number(nota || 0));
    return Array.from({ length: 5 }, (_, i) => i < n ? '★' : '☆').join('');
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

function normalizar(valor) {
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
    return ['troca', 'venda', 'ambos'].includes(tipo) ? tipo : 'troca';
}

function calcularTaxaPlataforma(valor) {
    return Number(valor || 0) * 0.08;
}

async function inicializarAdmin() {
    const { data: { user } } = await _supabase.auth.getUser();

    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    const { data: profile } = await _supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

    if (!profile || !profile.is_admin) {
        alert('Acesso negado!');
        window.location.href = 'index.html';
        return;
    }

    carregarDadosAdmin();
}

window.carregarDadosAdmin = async function () {
    setLoadingAdmin(true);

    const [livrosResp, perfisResp, mensagensResp, avaliacoesResp, pedidosResp] = await Promise.all([
        _supabase.from('livros').select('*'),
        _supabase.from('profiles').select('*'),
        _supabase.from('mensagens').select('id, livro_id, sender_id, receiver_id, created_at'),
        _supabase.from('avaliacoes_livros').select('*'),
        _supabase.from('pedidos').select('*').order('created_at', { ascending: false }),
    ]);

    setLoadingAdmin(false);

    if (livrosResp.error || perfisResp.error) {
        alert('Erro ao carregar painel admin. Verifique as permissões/RLS no Supabase.');
        return;
    }

    adminLivros = livrosResp.data || [];
    adminPerfis = perfisResp.data || [];
    adminMensagens = mensagensResp.data || [];
    adminAvaliacoes = avaliacoesResp.error ? [] : (avaliacoesResp.data || []);
    adminPedidos = pedidosResp.error ? [] : (pedidosResp.data || []);

    atualizarIndicadores();
    renderInsights();
    renderAdmin();
};

function setLoadingAdmin(loading) {
    const listas = ['listaGeralLivros', 'listaGeralUsuarios', 'listaAvaliacoesAdmin', 'listaPedidosAdmin', 'graficoTipos', 'graficoGeneros', 'rankingUsuarios', 'graficoPedidos'];
    if (!loading) return;
    listas.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<div class="admin-empty">Carregando dados...</div>';
    });
}

function atualizarIndicadores() {
    const valorAnunciado = adminLivros.reduce((total, l) => total + Number(l.preco || 0), 0);
    const anunciosVenda = adminLivros.filter(l => ['venda', 'ambos'].includes(getTipoSeguro(l.tipo))).length;

    document.getElementById('totalLivros').textContent = adminLivros.length;
    document.getElementById('totalUsuarios').textContent = adminPerfis.length;
    document.getElementById('totalMensagens').textContent = adminMensagens.length;
    document.getElementById('valorAnunciado').textContent = formatarPreco(valorAnunciado);
    document.getElementById('receitaSimulada').textContent = anunciosVenda;
    const totalAvaliacoes = document.getElementById('totalAvaliacoes');
    if (totalAvaliacoes) totalAvaliacoes.textContent = adminAvaliacoes.length;
    const totalPedidos = document.getElementById('totalPedidos');
    if (totalPedidos) totalPedidos.textContent = adminPedidos.length;
    const mediaAvaliacoes = document.getElementById('mediaAvaliacoes');
    if (mediaAvaliacoes) {
        const media = adminAvaliacoes.length ? adminAvaliacoes.reduce((s, av) => s + Number(av.nota || 0), 0) / adminAvaliacoes.length : 0;
        mediaAvaliacoes.textContent = adminAvaliacoes.length ? `${media.toFixed(1).replace('.', ',')} ★` : 'Sem dados';
    }
}

window.filtrarAdmin = function () {
    renderAdmin();
};

window.limparBuscaAdmin = function () {
    document.getElementById('adminBusca').value = '';
    document.getElementById('adminFiltroTipo').value = 'Todos';
    document.getElementById('adminFiltroGenero').value = 'Todos';
    const estado = document.getElementById('adminFiltroEstado');
    if (estado) estado.value = 'Todos';
    const pedido = document.getElementById('adminFiltroPedido');
    if (pedido) pedido.value = 'Todos';
    renderAdmin();
};

function renderAdmin() {
    const termo = normalizar(document.getElementById('adminBusca')?.value || '');
    const tipoFiltro = document.getElementById('adminFiltroTipo')?.value || 'Todos';
    const generoFiltro = document.getElementById('adminFiltroGenero')?.value || 'Todos';
    const estadoFiltro = document.getElementById('adminFiltroEstado')?.value || 'Todos';
    const pedidoFiltro = document.getElementById('adminFiltroPedido')?.value || 'Todos';

    const livrosFiltrados = adminLivros.filter(l => {
        const dono = adminPerfis.find(p => p.id === l.dono);
        const texto = `${l.titulo} ${l.autor} ${l.genero} ${TIPO_LABELS_ADMIN[getTipoSeguro(l.tipo)]} ${ESTADO_LABELS_ADMIN[getEstadoLivroSeguro(l.estado)]} ${dono?.nome || ''} ${dono?.cidade || ''}`;
        const bateTexto = normalizar(texto).includes(termo);
        const bateTipo = tipoFiltro === 'Todos' || getTipoSeguro(l.tipo) === tipoFiltro;
        const bateGenero = generoFiltro === 'Todos' || l.genero === generoFiltro;
        const bateEstado = estadoFiltro === 'Todos' || getEstadoLivroSeguro(l.estado) === estadoFiltro;
        return bateTexto && bateTipo && bateGenero && bateEstado;
    });

    const perfisFiltrados = adminPerfis.filter(p => {
        if (p.is_admin) return false;
        const totalLivros = adminLivros.filter(l => l.dono === p.id).length;
        const texto = `${p.nome || ''} ${p.cidade || ''} ${p.whatsapp || ''} ${totalLivros} livros`;
        return normalizar(texto).includes(termo);
    });

    document.getElementById('countLivrosFiltrados').textContent = livrosFiltrados.length;
    document.getElementById('countUsuariosFiltrados').textContent = perfisFiltrados.length;

    const avaliacoesFiltradas = adminAvaliacoes.filter(av => {
        const livro = adminLivros.find(l => String(l.id) === String(av.livro_id));
        const perfil = adminPerfis.find(p => p.id === av.user_id);
        const texto = `${livro?.titulo || ''} ${livro?.autor || ''} ${perfil?.nome || ''} ${av.comentario || ''}`;
        return normalizar(texto).includes(termo);
    });
    const countAvaliacoes = document.getElementById('countAvaliacoesFiltradas');
    if (countAvaliacoes) countAvaliacoes.textContent = avaliacoesFiltradas.length;

    const pedidosFiltrados = adminPedidos.filter(ped => {
        const livro = adminLivros.find(l => String(l.id) === String(ped.livro_id));
        const comprador = adminPerfis.find(p => p.id === ped.comprador_id);
        const vendedor = adminPerfis.find(p => p.id === ped.vendedor_id);
        const texto = `${livro?.titulo || ''} ${comprador?.nome || ''} ${vendedor?.nome || ''} ${PEDIDO_STATUS_LABELS[getStatusPedidoSeguro(ped.status)]} ${ped.forma_entrega || ''} ${ped.observacao || ''}`;
        const bateTexto = normalizar(texto).includes(termo);
        const bateStatus = pedidoFiltro === 'Todos' || getStatusPedidoSeguro(ped.status) === pedidoFiltro;
        return bateTexto && bateStatus;
    });
    const countPedidos = document.getElementById('countPedidosFiltrados');
    if (countPedidos) countPedidos.textContent = pedidosFiltrados.length;

    renderLivrosAdmin(livrosFiltrados);
    renderUsuariosAdmin(perfisFiltrados);
    renderPedidosAdmin(pedidosFiltrados);
    renderAvaliacoesAdmin(avaliacoesFiltradas);
}

function renderInsights() {
    renderGraficoTipos();
    renderGraficoGeneros();
    renderRankingUsuarios();
    renderGraficoPedidos();
}

function contarPor(campo) {
    return adminLivros.reduce((acc, livro) => {
        const chave = campo === 'tipo' ? getTipoSeguro(livro.tipo) : (livro[campo] || 'Outros');
        acc[chave] = (acc[chave] || 0) + 1;
        return acc;
    }, {});
}

function renderBarList(containerId, dados, labels = {}) {
    const container = document.getElementById(containerId);
    const entradas = Object.entries(dados).sort((a, b) => b[1] - a[1]);
    const maior = Math.max(...entradas.map(([, valor]) => valor), 1);

    if (entradas.length === 0) {
        container.innerHTML = '<div class="admin-empty">Sem dados para exibir.</div>';
        return;
    }

    container.innerHTML = entradas.map(([nome, valor]) => `
        <div class="bar-row">
            <div class="bar-info">
                <span>${escapeHTML(labels[nome] || nome)}</span>
                <strong>${valor}</strong>
            </div>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.max(8, (valor / maior) * 100)}%"></div></div>
        </div>
    `).join('');
}

function renderGraficoTipos() {
    renderBarList('graficoTipos', contarPor('tipo'), TIPO_LABELS_ADMIN);
}

function renderGraficoGeneros() {
    renderBarList('graficoGeneros', contarPor('genero'));
}

function renderGraficoPedidos() {
    const dados = adminPedidos.reduce((acc, pedido) => {
        const status = getStatusPedidoSeguro(pedido.status);
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});
    renderBarList('graficoPedidos', dados, PEDIDO_STATUS_LABELS);
}

function renderRankingUsuarios() {
    const container = document.getElementById('rankingUsuarios');
    const ranking = adminPerfis
        .filter(p => !p.is_admin)
        .map(p => ({
            ...p,
            totalLivros: adminLivros.filter(l => l.dono === p.id).length,
            mensagensRecebidas: adminMensagens.filter(m => m.receiver_id === p.id).length,
        }))
        .sort((a, b) => b.totalLivros - a.totalLivros)
        .slice(0, 5);

    if (ranking.length === 0) {
        container.innerHTML = '<div class="admin-empty">Nenhum usuário comum encontrado.</div>';
        return;
    }

    container.innerHTML = ranking.map((p, index) => `
        <div class="ranking-item">
            <span class="ranking-position">${index + 1}</span>
            <div>
                <strong>${escapeHTML(p.nome || 'Sem nome')}</strong>
                <small>${p.totalLivros} anúncio(s) • ${p.mensagensRecebidas} mensagem(ns) recebida(s)</small>
            </div>
        </div>
    `).join('');
}

function renderLivrosAdmin(livros) {
    const lista = document.getElementById('listaGeralLivros');
    lista.innerHTML = '';

    if (livros.length === 0) {
        lista.innerHTML = '<div class="admin-empty">Nenhum livro encontrado.</div>';
        return;
    }

    livros.forEach(l => {
        const dono = adminPerfis.find(p => p.id === l.dono);
        const tipo = getTipoSeguro(l.tipo);
        const mensagensLivro = adminMensagens.filter(m => String(m.livro_id) === String(l.id)).length;
        const avaliacoesLivro = adminAvaliacoes.filter(av => String(av.livro_id) === String(l.id));
        const media = avaliacoesLivro.length ? avaliacoesLivro.reduce((s, av) => s + Number(av.nota || 0), 0) / avaliacoesLivro.length : 0;

        const div = document.createElement('div');
        div.className = 'admin-card premium-admin-card admin-book-row';
        div.innerHTML = `
            ${renderAdminCover(l)}
            <div class="admin-card-info">
                <div class="admin-card-title-row">
                    <h4>${escapeHTML(l.titulo || 'Sem título')}</h4>
                    <span class="admin-pill">${escapeHTML(TIPO_LABELS_ADMIN[tipo])}</span>
                </div>
                <p>${escapeHTML(l.autor || 'Autor não informado')} • ${escapeHTML(l.genero || 'Sem gênero')} • ${escapeHTML(ESTADO_LABELS_ADMIN[getEstadoLivroSeguro(l.estado)])}</p>
                <p>Dono: ${escapeHTML(dono?.nome || 'Desconhecido')} ${dono?.cidade ? '• ' + escapeHTML(dono.cidade) : ''}</p>
                <div class="admin-meta-line">
                    <span>${tipo !== 'troca' && Number(l.preco) > 0 ? formatarPreco(l.preco) : 'Sem preço / troca'}</span>
                    <span>${mensagensLivro} mensagem(ns)</span>
                    <span>${getFotosLivro(l).length} foto(s)</span>
                    <span>${avaliacoesLivro.length ? `${renderStars(media)} ${media.toFixed(1).replace('.', ',')}` : 'Sem avaliação'}</span>
                </div>
            </div>
        `;

        const btn = document.createElement('button');
        btn.className = 'btn-danger';
        btn.textContent = 'Remover';
        btn.addEventListener('click', () => deletarLivro(l.id));
        div.appendChild(btn);
        lista.appendChild(div);
    });
}

function renderUsuariosAdmin(perfis) {
    const lista = document.getElementById('listaGeralUsuarios');
    lista.innerHTML = '';

    if (perfis.length === 0) {
        lista.innerHTML = '<div class="admin-empty">Nenhum usuário encontrado.</div>';
        return;
    }

    perfis.forEach(p => {
        const totalLivros = adminLivros.filter(l => l.dono === p.id).length;
        const livrosComPreco = adminLivros.filter(l => l.dono === p.id && Number(l.preco || 0) > 0);
        const valorAnunciado = livrosComPreco.reduce((total, l) => total + Number(l.preco || 0), 0);
        const mensagens = adminMensagens.filter(m => m.sender_id === p.id || m.receiver_id === p.id).length;

        const div = document.createElement('div');
        div.className = 'admin-card premium-admin-card';
        div.innerHTML = `
            <div class="admin-card-info">
                <div class="admin-card-title-row">
                    <h4>${escapeHTML(p.nome || 'Sem nome')}</h4>
                    <span class="admin-pill user-pill">Usuário</span>
                </div>
                <p>${escapeHTML(p.cidade || 'Cidade não informada')} ${p.whatsapp ? '• WhatsApp: ' + escapeHTML(p.whatsapp) : ''}</p>
                <div class="admin-meta-line">
                    <span>${totalLivros} livro(s)</span>
                    <span>${formatarPreco(valorAnunciado)} anunciados</span>
                    <span>${mensagens} mensagem(ns)</span>
                </div>
            </div>
        `;

        const btn = document.createElement('button');
        btn.className = 'btn-danger';
        btn.textContent = 'Excluir dados';
        btn.title = 'Remove dados do usuário no banco, mas não apaga o login do Supabase Auth.';
        btn.addEventListener('click', () => excluirDadosUsuario(p.id));
        div.appendChild(btn);
        lista.appendChild(div);
    });
}


function renderPedidosAdmin(pedidos) {
    const lista = document.getElementById('listaPedidosAdmin');
    if (!lista) return;
    lista.innerHTML = '';

    if (!pedidos || pedidos.length === 0) {
        lista.innerHTML = '<div class="admin-empty">Nenhum pedido encontrado.</div>';
        return;
    }

    pedidos.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).forEach(pedido => {
        const livro = adminLivros.find(l => String(l.id) === String(pedido.livro_id));
        const comprador = adminPerfis.find(p => p.id === pedido.comprador_id);
        const vendedor = adminPerfis.find(p => p.id === pedido.vendedor_id);
        const status = getStatusPedidoSeguro(pedido.status);

        const div = document.createElement('div');
        div.className = 'admin-card premium-admin-card admin-order-card';
        div.innerHTML = `
            <div class="admin-card-info">
                <div class="admin-card-title-row">
                    <h4>${escapeHTML(livro?.titulo || 'Livro removido')}</h4>
                    <span class="admin-pill pedido-${status}">${escapeHTML(PEDIDO_STATUS_LABELS[status])}</span>
                </div>
                <p>Comprador: ${escapeHTML(comprador?.nome || 'Usuário')} • Vendedor: ${escapeHTML(vendedor?.nome || 'Usuário')}</p>
                <div class="admin-meta-line">
                    <span>${formatarPreco(pedido.valor || 0)}</span>
                    <span>${escapeHTML(pedido.forma_entrega || 'combinar')}</span>
                    <span>${new Date(pedido.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
                ${pedido.observacao ? `<p class="admin-review-comment">${escapeHTML(pedido.observacao)}</p>` : ''}
            </div>
            <div class="admin-card-actions-stack">
                <select onchange="atualizarStatusPedido('${escapeHTML(pedido.id)}', this.value)">
                    ${Object.entries(PEDIDO_STATUS_LABELS).map(([value, label]) => `<option value="${value}" ${value === status ? 'selected' : ''}>${label}</option>`).join('')}
                </select>
                <button class="btn-danger" onclick="deletarPedido('${escapeHTML(pedido.id)}')">Remover</button>
            </div>
        `;
        lista.appendChild(div);
    });
}

window.atualizarStatusPedido = async function (id, status) {
    const seguro = getStatusPedidoSeguro(status);
    const { error } = await _supabase.from('pedidos').update({ status: seguro, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) alert('Erro: ' + error.message);
    else {
        const pedido = adminPedidos.find(p => String(p.id) === String(id));
        if (pedido) pedido.status = seguro;
        atualizarIndicadores();
        renderInsights();
        renderAdmin();
    }
};

window.deletarPedido = async function (id) {
    if (!confirm('Remover este pedido do painel?')) return;
    const { error } = await _supabase.from('pedidos').delete().eq('id', id);
    if (error) alert('Erro: ' + error.message);
    else {
        adminPedidos = adminPedidos.filter(p => String(p.id) !== String(id));
        atualizarIndicadores();
        renderInsights();
        renderAdmin();
    }
};

function renderAvaliacoesAdmin(avaliacoes) {
    const lista = document.getElementById('listaAvaliacoesAdmin');
    if (!lista) return;
    lista.innerHTML = '';

    if (!avaliacoes || avaliacoes.length === 0) {
        lista.innerHTML = '<div class="admin-empty">Nenhuma avaliação encontrada.</div>';
        return;
    }

    avaliacoes
        .slice()
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .forEach(av => {
            const livro = adminLivros.find(l => String(l.id) === String(av.livro_id));
            const perfil = adminPerfis.find(p => p.id === av.user_id);
            const div = document.createElement('div');
            div.className = 'admin-card premium-admin-card admin-review-card';
            div.innerHTML = `
                <div class="admin-card-info">
                    <div class="admin-card-title-row">
                        <h4>${escapeHTML(livro?.titulo || 'Livro removido')}</h4>
                        <span class="admin-pill">${renderStars(av.nota)}</span>
                    </div>
                    <p>Autor: ${escapeHTML(livro?.autor || 'Não informado')} • Avaliado por ${escapeHTML(perfil?.nome || 'Usuário')}</p>
                    <p class="admin-review-comment">“${escapeHTML(av.comentario || 'Sem comentário escrito.')}”</p>
                    <div class="admin-meta-line">
                        <span>${new Date(av.created_at).toLocaleDateString('pt-BR')}</span>
                        <span>${Number(av.nota || 0)} estrela(s)</span>
                    </div>
                </div>
            `;

            const btn = document.createElement('button');
            btn.className = 'btn-danger';
            btn.textContent = 'Remover comentário';
            btn.addEventListener('click', () => deletarAvaliacao(av.id));
            div.appendChild(btn);
            lista.appendChild(div);
        });
}

window.deletarAvaliacao = async function (id) {
    if (!confirm('Remover esta avaliação/comentário?')) return;
    const { error } = await _supabase.from('avaliacoes_livros').delete().eq('id', id);
    if (error) alert('Erro: ' + error.message);
    else {
        adminAvaliacoes = adminAvaliacoes.filter(av => String(av.id) !== String(id));
        atualizarIndicadores();
        renderAdmin();
    }
};

window.deletarLivro = async function (id) {
    if (!confirm('Tem certeza que deseja apagar este livro?')) return;

    const { error } = await _supabase.from('livros').delete().eq('id', id);
    if (error) alert('Erro: ' + error.message);
    else {
        adminLivros = adminLivros.filter(l => String(l.id) !== String(id));
        atualizarIndicadores();
        renderInsights();
        renderAdmin();
    }
};

window.excluirDadosUsuario = async function (id) {
    const perfil = adminPerfis.find(p => p.id === id);
    const nome = perfil?.nome || 'este usuário';
    if (!confirm(`Excluir os dados de ${nome}?\n\nIsso remove perfil, anúncios, mensagens, avaliações, biblioteca e pedidos ligados ao usuário. O login no Supabase Auth não é apagado pelo navegador.`)) return;
    if (!confirm('Confirma novamente? Essa ação não pode ser desfeita pelo painel.')) return;

    const operacoes = [
        _supabase.from('pedidos').delete().or(`comprador_id.eq.${id},vendedor_id.eq.${id}`),
        _supabase.from('avaliacoes_livros').delete().eq('user_id', id),
        _supabase.from('registros_leitura').delete().eq('user_id', id),
        _supabase.from('biblioteca_usuario').delete().eq('user_id', id),
        _supabase.from('metas_leitura').delete().eq('user_id', id),
        _supabase.from('mensagens').delete().or(`sender_id.eq.${id},receiver_id.eq.${id}`),
        _supabase.from('livros').delete().eq('dono', id),
        _supabase.from('profiles').delete().eq('id', id),
    ];

    const resultados = await Promise.allSettled(operacoes);
    const erro = resultados.find(r => r.status === 'fulfilled' && r.value.error)?.value.error || resultados.find(r => r.status === 'rejected')?.reason;

    if (erro) alert('Alguns dados não puderam ser removidos. Verifique as permissões/RLS: ' + (erro.message || erro));
    await carregarDadosAdmin();
};

window.logoutAdmin = async function () {
    await _supabase.auth.signOut();
    localStorage.removeItem('usuario');
    window.location.href = 'login.html';
};

inicializarAdmin();
