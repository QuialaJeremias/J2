/*
    adminAuth.js
    ----------
    Este arquivo centraliza o acesso ao contexto do administrador salvo
    em localStorage. Ele define utilitários para:
      - recuperar dados do admin atual
      - validar se o usuário é admin/master
      - forçar redirecionamento para a tela de login
      - criar queries Firestore restritas por instituto
*/
(function (window) {
    const STORAGE_KEYS = {
        level: 'nivel',
        instituteId: 'instituto_id',
        adminName: 'nome_admin',
        adminId: 'admin_id',
        adminEmail: 'admin_email'
    };

    function normalizeString(value) {
        return typeof value === 'string' ? value.trim() : '';
    }

    // Recupera o contexto do administrador atual a partir do localStorage.
    // Retorna um objeto com flags de permissão e dados do administrador.
    function getAdminContext() {
        const level = normalizeString(localStorage.getItem(STORAGE_KEYS.level)).toLowerCase();
        const instituto_id = normalizeString(localStorage.getItem(STORAGE_KEYS.instituteId));
        const nome_admin = normalizeString(localStorage.getItem(STORAGE_KEYS.adminName));
        const admin_id = normalizeString(localStorage.getItem(STORAGE_KEYS.adminId));
        const admin_email = normalizeString(localStorage.getItem(STORAGE_KEYS.adminEmail));
        const isMaster = level === 'master';
        const isAdmin = ['admin', 'moderador', 'visualizador'].includes(level);

        return {
            level,
            instituto_id,
            nome_admin,
            admin_id,
            admin_email,
            isMaster,
            isAdmin,
            valid: (isMaster || isAdmin) && nome_admin.length > 0 && (isMaster || instituto_id.length > 0)
        };
    }

    // Verifica se há um contexto de admin válido.
    // Se inválido, pode redirecionar para a página de login.
    function requireAdminContext(options) {
        const { loginPage = 'admin.html', redirectOnFail = true } = options || {};
        const context = getAdminContext();
        if (!context.valid) {
            console.warn('MultiAdminAuth: dados de sessão inválidos. Acesso negado.');
            if (redirectOnFail) {
                window.location.href = loginPage;
            }
            return null;
        }
        return context;
    }

    // Constrói uma query Firestore que restringe dados ao instituto do admin.
    // Master vê todos os documentos; admins padrão recebem apenas seu instituto.
    function buildAdminQuery(collectionRef, options) {
        const { field = 'instituto_id', loginPage = 'admin.html' } = options || {};
        const context = requireAdminContext({ loginPage, redirectOnFail: false });
        if (!context) {
            console.warn('MultiAdminAuth: contexto de admin inválido durante a construção da query.');
            return null;
        }
        if (context.isMaster) {
            return collectionRef;
        }
        return collectionRef.where(field, '==', context.instituto_id);
    }

    function clearAdminContext() {
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
    }

    // Garante que somente o administrador master tenha acesso.
    // Ao falhar, exibe alerta e redireciona para o login.
    function ensureMasterAccess(loginPage = 'admin.html') {
        const context = requireAdminContext({ loginPage });
        if (!context || !context.isMaster) {
            alert('Apenas o administrador master tem acesso a esta página.');
            window.location.href = loginPage;
            return false;
        }
        return true;
    }

    // Inicializa a interface de administração, escondendo controles master-only
    // e chamando um callback opcional quando o contexto estiver pronto.
    function setupAdminInterface(options) {
        const { loginPage = 'admin.html', masterOnlySelector = '.master-only', onLoaded } = options || {};
        const context = requireAdminContext({ loginPage });
        if (!context) {
            return null;
        }
        document.querySelectorAll(masterOnlySelector).forEach(el => {
            el.style.display = context.isMaster ? '' : 'none';
        });
        if (typeof onLoaded === 'function') {
            onLoaded(context);
        }
        return context;
    }

    window.MultiAdminAuth = {
        STORAGE_KEYS,
        getAdminContext,
        requireAdminContext,
        buildAdminQuery,
        clearAdminContext,
        ensureMasterAccess,
        setupAdminInterface
    };
})(window);
