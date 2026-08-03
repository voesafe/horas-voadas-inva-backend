/**
 * Lógica do Painel de Horas Voadas
 */

// CONFIGURAÇÃO: Insira aqui a URL gerada após a implantação do Google Apps Script
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxnHgXqi4Q0zcFPULMdSNmoOT8Ro4KkIeEFZefTpaXNH3CDG2bND220MlKDTNDBGHucyA/exec';

// Estado da Aplicação
let instructors = [];
let hoursChart = null;

// Elementos do DOM
const navLinks = document.querySelectorAll('.nav-link');
const views = document.querySelectorAll('.view');
const loadingEl = document.getElementById('loading');
const instructorTableBody = document.querySelector('#instructor-table tbody');
const btnSync = document.getElementById('btn-sync');

// Navegação
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        const targetView = e.target.getAttribute('data-view');
        
        navLinks.forEach(l => l.classList.remove('active'));
        e.target.classList.add('active');
        
        views.forEach(view => {
            view.classList.remove('active');
            if (view.id === targetView) {
                view.classList.add('active');
            }
        });

        if (targetView === 'dashboard') {
            fetchData();
        }
    });
});

// Sincronização CAVOK
btnSync.addEventListener('click', async () => {
    const today = new Date().toISOString().split('T')[0];
    btnSync.disabled = true;
    btnSync.textContent = 'Sincronizando...';
    
    try {
        const response = await fetch(`${WEB_APP_URL}?action=sync_cavok&date=${today}`, {
            method: 'GET',
            mode: 'cors',
            redirect: 'follow'
        });
        
        const result = await response.json();
        if (result.status === 'success') {
            alert(result.message);
            fetchData();
        } else {
            alert('Erro: ' + result.message);
        }
    } catch (error) {
        console.error('Erro no sync:', error);
        alert('Erro de conexão. Detalhes no console do navegador (F12).');
    } finally {
        btnSync.disabled = false;
        btnSync.textContent = 'Sincronizar CAVOK';
    }
});

// Busca de Dados
async function fetchData() {
    if (!WEB_APP_URL || WEB_APP_URL.includes('SUA_URL')) return;

    loadingEl.style.display = 'block';
    try {
        const response = await fetch(`${WEB_APP_URL}?action=get_data`, {
            method: 'GET',
            mode: 'cors',
            redirect: 'follow'
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            instructors = result.data;
            renderDashboard();
        } else {
            console.error('Erro retornado pelo script:', result.message);
        }
    } catch (error) {
        console.error('Erro ao buscar dados:', error);
    } finally {
        loadingEl.style.display = 'none';
    }
}

function renderDashboard() {
    // Preparar dados para o Gráfico
    const labels = instructors.map(ins => ins.nome);
    const dataValues = instructors.map(ins => parseFloat(ins.totalHoras));
    
    const canvas = document.getElementById('hoursChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Se o gráfico já existe, destrói para criar um novo (evita sobreposição)
    if (hoursChart) {
        hoursChart.destroy();
    }
    
    hoursChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total de Horas Voadas',
                data: dataValues,
                backgroundColor: '#5BAEE2',
                borderColor: '#1D2951',
                borderWidth: 1,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Horas'
                    }
                },
                x: {
                    ticks: {
                        autoSkip: false,
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.raw + ' horas';
                        }
                    }
                }
            }
        }
    });

    // Renderizar Tabela
    instructorTableBody.innerHTML = '';
    instructors.forEach(ins => {
        const row = document.createElement('tr');
        const badgeClass = ins.tipo && ins.tipo.toLowerCase() === 'clt' ? 'badge-clt' : 'badge-eventual';
        row.innerHTML = `
            <td><strong>${ins.nome}</strong></td>
            <td><span class="badge ${badgeClass}">${ins.tipo || 'N/A'}</span></td>
            <td>${ins.totalHoras}h</td>
        `;
        instructorTableBody.appendChild(row);
    });
}

// Formulário de Cadastro
document.getElementById('form-instrutor').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        nome: document.getElementById('nome').value,
        tipo: document.getElementById('tipo').value,
        saldoInicial: document.getElementById('saldo-inicial').value || 0
    };

    const result = await sendData('add_instructor', data);
    if (result && result.status === 'success') {
        alert('Instrutor cadastrado com sucesso!');
        e.target.reset();
        fetchData();
    }
});

async function sendData(action, data) {
    if (!WEB_APP_URL || WEB_APP_URL.includes('SUA_URL')) {
        alert('Por favor, configure a URL do Apps Script no arquivo app.js');
        return;
    }

    try {
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            body: JSON.stringify({ action, data })
        });
        
        return await response.json();
    } catch (error) {
        console.error('Erro ao enviar dados:', error);
        alert('Erro ao enviar dados. Verifique o console.');
    }
}

// Inicialização
window.addEventListener('DOMContentLoaded', () => {
    if (WEB_APP_URL && !WEB_APP_URL.includes('SUA_URL')) {
        fetchData();
    }
});
