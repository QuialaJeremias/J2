// Função para guardar a escolha no navegador
function guardarEscolha(area) {
    // 1. Ir buscar o que já foi respondido ou criar um objeto vazio
    let progresso = JSON.parse(localStorage.getItem('respostasAvaliacao')) || {
        tech: 0, saude: 0, negocios: 0, eng: 0, agro: 0
    };

    // 2. Adicionar 1 ponto à área selecionada
    if (area) {
        progresso[area] += 1;
    }

    // 3. Salvar de volta no localStorage
    localStorage.setItem('respostasAvaliacao', JSON.stringify(progresso));
}