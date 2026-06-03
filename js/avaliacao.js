let respostas = JSON.parse(localStorage.getItem("respostas")) || [];

function guardarResposta(valor){
    respostas.push(valor);
    localStorage.setItem("respostas", JSON.stringify(respostas));
}