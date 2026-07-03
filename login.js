let isLoginMode = true;

window.toggleMode = function () {
    isLoginMode = !isLoginMode;
    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');
    const btnText = document.getElementById('btn-text');
    const toggle = document.getElementById('toggle-text');
    const confirmGroup = document.getElementById('confirm-password-group');
    const confirmInput = document.getElementById('confirm-password');
    hideError();

    if (isLoginMode) {
        title.innerText = 'Bem-vindo de volta';
        subtitle.innerText = 'Acesse sua conta para continuar explorando e negociando livros.'
        btnText.innerText = 'Entrar';
        if (confirmGroup) confirmGroup.style.display = 'none';
        if (confirmInput) confirmInput.value = '';
        toggle.innerHTML = 'Não tem uma conta? <a href="#" onclick="window.toggleMode(); return false;">Criar conta grátis</a>';
    } else {
        title.innerText = 'Criar conta';
        subtitle.innerText = 'Crie sua conta para anunciar livros e conversar com outros leitores.'
        btnText.innerText = 'Cadastrar';
        if (confirmGroup) confirmGroup.style.display = 'block';
        toggle.innerHTML = 'Já tem conta? <a href="#" onclick="window.toggleMode(); return false;">Fazer login</a>';
    }
};

window.handleAuth = async function () {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password')?.value || '';

    hideError();

    if (!email || !password) { showError('Preencha todos os campos.'); return; }
    if (password.length < 6) { showError('A senha deve ter pelo menos 6 caracteres.'); return; }
    if (!isLoginMode && password !== confirmPassword) { showError('As senhas digitadas não conferem.'); return; }

    setLoading(true);

    try {
        if (isLoginMode) {
            const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;

            localStorage.setItem('usuario', data.user.email);

            const { data: profile } = await _supabase
                .from('profiles')
                .select('id, nome, is_admin')
                .eq('id', data.user.id)
                .single();

            if (!profile || !profile.nome) window.location.href = 'perfil.html';
            else if (profile.is_admin) window.location.href = 'admin.html';
            else window.location.href = 'index.html';

        } else {
            const { data, error } = await _supabase.auth.signUp({ email, password });
            if (error) throw error;

            if (data.session || data.user) {
                localStorage.setItem('usuario', data.user?.email || email);
                window.location.href = 'perfil.html';
            } else {
                showError('Cadastro criado. Verifique seu e-mail para confirmar a conta.');
                window.toggleMode();
            }
        }
    } catch (err) {
        const msgs = {
            'Invalid login credentials': 'E-mail ou senha incorretos.',
            'Email not confirmed': 'Confirme seu e-mail antes de entrar.',
            'User already registered': 'Este e-mail já está cadastrado.',
        };
        showError(msgs[err.message] || err.message || 'Ocorreu um erro. Tente novamente.');
    } finally {
        setLoading(false);
    }
};

window.togglePasswordVisibility = function (inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const mostrar = input.type === 'password';
    input.type = mostrar ? 'text' : 'password';
    if (btn) btn.textContent = mostrar ? 'Ocultar' : 'Mostrar';
};

function setLoading(state) {
    const btn = document.getElementById('btn-login');
    const txt = document.getElementById('btn-text');
    const loading = document.getElementById('btn-loading');
    btn.disabled = state;
    txt.style.display = state ? 'none' : 'inline';
    loading.style.display = state ? 'inline' : 'none';
}

function showError(msg) {
    const el = document.getElementById('form-error');
    el.textContent = msg;
    el.style.display = 'block';
}

function hideError() {
    const el = document.getElementById('form-error');
    el.style.display = 'none';
}
