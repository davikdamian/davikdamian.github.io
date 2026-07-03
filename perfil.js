let fotoPerfilBase64 = '';
let fotoRemovida = false;
let usuarioAtualPerfil = null;
let cidadeSalvaPerfil = '';
let ufSalvaPerfil = '';

document.addEventListener('DOMContentLoaded', async () => {
    await carregarEstadosIBGE();
    await carregarPerfilAtual();
});


const IBGE_BASE_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades';

function separarCidadeUF(valor) {
    const partes = String(valor || '').split(' - ');
    return {
        cidade: partes[0] || '',
        uf: partes[1] || '',
    };
}

window.carregarEstadosIBGE = async function () {
    const ufSelect = document.getElementById('p-uf');
    if (!ufSelect) return;

    try {
        const resp = await fetch(`${IBGE_BASE_URL}/estados?orderBy=nome`);
        const estados = await resp.json();
        ufSelect.innerHTML = '<option value="">Selecione o estado</option>' + estados
            .map(uf => `<option value="${uf.sigla}">${uf.nome} (${uf.sigla})</option>`)
            .join('');
    } catch (_) {
        ufSelect.innerHTML = '<option value="">Não foi possível carregar estados</option>';
        mostrarErroPerfil('Não foi possível carregar estados/cidades. Verifique sua conexão e tente novamente.');
    }
};

window.carregarCidadesIBGE = async function (uf, cidadeSelecionada = '') {
    const cidadeSelect = document.getElementById('p-cidade');
    if (!cidadeSelect) return;

    if (!uf) {
        cidadeSelect.disabled = true;
        cidadeSelect.innerHTML = '<option value="">Selecione o estado primeiro</option>';
        return;
    }

    cidadeSelect.disabled = true;
    cidadeSelect.innerHTML = '<option value="">Carregando cidades...</option>';

    try {
        const resp = await fetch(`${IBGE_BASE_URL}/estados/${uf}/municipios?orderBy=nome`);
        const cidades = await resp.json();
        cidadeSelect.innerHTML = '<option value="">Selecione a cidade</option>' + cidades
            .map(cidade => `<option value="${cidade.nome}">${cidade.nome}</option>`)
            .join('');
        cidadeSelect.disabled = false;
        if (cidadeSelecionada) cidadeSelect.value = cidadeSelecionada;
    } catch (_) {
        cidadeSelect.innerHTML = '<option value="">Erro ao carregar cidades</option>';
        mostrarErroPerfil('Não foi possível carregar as cidades do estado selecionado.');
    }
};

async function aplicarCidadeSalva(cidadeCompleta) {
    const ufSelect = document.getElementById('p-uf');
    const { cidade, uf } = separarCidadeUF(cidadeCompleta);
    cidadeSalvaPerfil = cidade;
    ufSalvaPerfil = uf;

    if (ufSelect && uf) {
        ufSelect.value = uf;
        await carregarCidadesIBGE(uf, cidade);
    } else if (ufSelect) {
        await carregarCidadesIBGE('');
    }
}

async function carregarPerfilAtual() {
    const erroEl = document.getElementById('perfil-error');
    const { data: { user }, error: userError } = await _supabase.auth.getUser();

    if (userError || !user) {
        if (erroEl) {
            erroEl.textContent = 'Sessão expirada. Faça login novamente.';
            erroEl.style.display = 'block';
        }
        return;
    }

    usuarioAtualPerfil = user;

    let resp = await _supabase
        .from('profiles')
        .select('nome, whatsapp, cidade, foto_url')
        .eq('id', user.id)
        .maybeSingle();

    if (resp.error && String(resp.error.message || '').toLowerCase().includes('foto_url')) {
        resp = await _supabase
            .from('profiles')
            .select('nome, whatsapp, cidade')
            .eq('id', user.id)
            .maybeSingle();
    }

    if (resp.error) return;
    const perfil = resp.data;
    if (!perfil) return;

    document.getElementById('p-nome').value = perfil.nome || '';
    document.getElementById('p-whatsapp').value = perfil.whatsapp || '';
    await aplicarCidadeSalva(perfil.cidade || '');
    fotoPerfilBase64 = perfil.foto_url || '';
    aplicarPreviewFoto(fotoPerfilBase64);

    const back = document.getElementById('back-link');
    if (back) back.style.display = 'inline-block';
    const btnTxt = document.getElementById('btn-txt');
    if (btnTxt) btnTxt.textContent = 'Salvar alterações';
}

window.previewFotoPerfil = function (event) {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    if (!arquivo.type.startsWith('image/')) {
        mostrarErroPerfil('Escolha um arquivo de imagem.');
        return;
    }

    if (arquivo.size > 5 * 1024 * 1024) {
        mostrarErroPerfil('Escolha uma imagem com até 5 MB.');
        return;
    }

    const reader = new FileReader();
    reader.onload = () => redimensionarImagem(reader.result, 420, 0.82)
        .then((dataUrl) => {
            fotoPerfilBase64 = dataUrl;
            fotoRemovida = false;
            aplicarPreviewFoto(dataUrl);
        })
        .catch(() => mostrarErroPerfil('Não foi possível processar a imagem.'));
    reader.readAsDataURL(arquivo);
};

function redimensionarImagem(src, tamanhoMaximo = 420, qualidade = 0.82) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const escala = Math.min(1, tamanhoMaximo / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(img.width * escala));
            canvas.height = Math.max(1, Math.round(img.height * escala));
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', qualidade));
        };
        img.onerror = reject;
        img.src = src;
    });
}

function aplicarPreviewFoto(src) {
    const img = document.getElementById('fotoPreview');
    const txt = document.getElementById('fotoPreviewText');
    const avatar = document.getElementById('avatarEl');

    if (src) {
        if (img) {
            img.src = src;
            img.style.display = 'block';
        }
        if (txt) txt.style.display = 'none';
        if (avatar) {
            avatar.textContent = '';
            avatar.style.backgroundImage = `url("${src}")`;
            avatar.classList.add('has-photo');
        }
    } else {
        if (img) {
            img.removeAttribute('src');
            img.style.display = 'none';
        }
        if (txt) txt.style.display = 'inline';
        if (avatar) {
            avatar.textContent = '📚';
            avatar.style.backgroundImage = '';
            avatar.classList.remove('has-photo');
        }
    }
}

window.removerFotoPerfil = function () {
    fotoPerfilBase64 = '';
    fotoRemovida = true;
    const input = document.getElementById('p-foto');
    if (input) input.value = '';
    aplicarPreviewFoto('');
};

function mostrarErroPerfil(msg) {
    const erroEl = document.getElementById('perfil-error');
    erroEl.textContent = msg;
    erroEl.style.display = 'block';
}

async function salvarPerfil() {
    const nome = document.getElementById('p-nome').value.trim();
    const whatsapp = document.getElementById('p-whatsapp').value.trim();
    const uf = document.getElementById('p-uf')?.value || '';
    const cidadeNome = document.getElementById('p-cidade')?.value || '';
    const cidade = cidadeNome && uf ? `${cidadeNome} - ${uf}` : '';
    const erroEl = document.getElementById('perfil-error');
    const btn = document.getElementById('btn-salvar');
    const btnTxt = document.getElementById('btn-txt');
    const btnLoad = document.getElementById('btn-load');

    erroEl.style.display = 'none';

    if (!nome || !whatsapp) {
        mostrarErroPerfil('Nome e WhatsApp são obrigatórios.');
        return;
    }

    if ((uf && !cidadeNome) || (!uf && cidadeNome)) {
        mostrarErroPerfil('Selecione estado e cidade corretamente.');
        return;
    }

    btn.disabled = true;
    btnTxt.style.display = 'none';
    btnLoad.style.display = 'inline';

    const { data: { user }, error: userError } = await _supabase.auth.getUser();

    if (userError || !user) {
        mostrarErroPerfil('Sessão expirada. Faça login novamente.');
        btn.disabled = false;
        btnTxt.style.display = 'inline';
        btnLoad.style.display = 'none';
        return;
    }

    const dadosComFoto = {
        id: user.id,
        nome,
        whatsapp,
        cidade,
        foto_url: fotoPerfilBase64 || null,
    };

    let { error } = await _supabase
        .from('profiles')
        .upsert(dadosComFoto);

    // Caso o usuário ainda não tenha executado o SQL que adiciona a coluna foto_url,
    // salva o perfil normalmente sem a foto para não travar o restante do site.
    if (error && String(error.message || '').toLowerCase().includes('foto_url')) {
        const dadosSemFoto = { id: user.id, nome, whatsapp, cidade };
        const fallback = await _supabase.from('profiles').upsert(dadosSemFoto);
        error = fallback.error;
    }

    btn.disabled = false;
    btnTxt.style.display = 'inline';
    btnLoad.style.display = 'none';

    if (error) {
        mostrarErroPerfil('Erro ao salvar perfil: ' + error.message);
        return;
    }

    window.location.href = 'index.html';
}
