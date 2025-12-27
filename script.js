// Configuration
const TEAM_NAMES = ['Malnad Bulls', 'Crimson Warriors', 'Friends XI', 'Bengaluru Gladiators', 'Mysore Karadas', 'SDP GC', 'UCCB', 'Sanatan Strikers'];
//const EXCEL_FOLDER = 'excel_data/'; // Folder where Excel files are stored
const EXCEL_FOLDER = 'https://1drv.ms/f/c/a544a38d50095bd1/IgB2fAeEvrI0RoY35ynCg4o2Acl1zcOhe7UgvmMuRntgvqQ?e=IgR5pz/';

// Global data store
let teamsData = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadAllTeamsData();

    // Add refresh button listener
    document.getElementById('refreshBtn').addEventListener('click', () => {
        loadAllTeamsData();
    });
});

// Load data for all teams
async function loadAllTeamsData() {
    showLoading(true);
    hideError();
    teamsData = [];

    try {
        // Load each team's Excel file
        for (const teamName of TEAM_NAMES) {
            try {
                const teamData = await loadTeamExcel(teamName);
                if (teamData) {
                    teamsData.push(teamData);
                }
            } catch (error) {
                console.error(`Error loading team ${teamName}:`, error);
                // Continue loading other teams even if one fails
            }
        }

        if (teamsData.length === 0) {
            throw new Error('No team data could be loaded. Please ensure Excel files are in the excel_data folder.');
        }

        displayTeams();
        updateLastUpdatedTime();
        showLoading(false);
    } catch (error) {
        showError(error.message);
        showLoading(false);
    }
}

// Load Excel file for a specific team
async function loadTeamExcel(teamName) {
    const fileName = `${EXCEL_FOLDER}${teamName}.csv`;

    try {
        const response = await fetch(fileName);
        if (!response.ok) {
            throw new Error(`Failed to load ${fileName}`);
        }

        const csvText = await response.text();
        
        // Parse CSV manually
        const lines = csvText.trim().split('\n');
        if (lines.length <= 1) {
            throw new Error(`No data in ${fileName}`);
        }
        
        // Parse header
        const headers = parseCSVLine(lines[0]);
        
        // Parse data rows
        const jsonData = [];
        jsonData.push(headers);
        for (let i = 1; i < lines.length; i++) {
            jsonData.push(parseCSVLine(lines[i]));
        }

        // Parse the data
        const teamData = parseTeamData(teamName, jsonData);
        return teamData;
    } catch (error) {
        console.error(`Error loading ${fileName}:`, error);
        return null;
    }
}

// Parse CSV line
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let insideQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

// Parse Excel data into structured format
function parseTeamData(teamName, data) {
    if (!data || data.length < 2) {
        return null;
    }

    // First row is headers, rest are data rows
    const headers = data[0];
    const dataRows = data.slice(1);

    // Find column indices
    const nameIndex = 0;  // Player Name is first column
    const bidIndex = 1;   // Bid Amount is second column

    // Check if last row is the "Remaining Bid Amount" row
    let remainingBidAmount = 0;
    let playerRows = dataRows;

    const lastRow = dataRows[dataRows.length - 1];
    if (lastRow && lastRow[nameIndex] &&
        lastRow[nameIndex].toString().toLowerCase().includes('remaining')) {
        remainingBidAmount = parseFloat(lastRow[bidIndex]) || 0;
        playerRows = dataRows.slice(0, -1);  // Exclude the remaining bid row
    }

    // Parse players
    const players = playerRows
        .filter(row => row && row[nameIndex]) // Filter out empty rows
        .map(row => ({
            name: row[nameIndex] || 'Unknown',
            bidAmount: formatCurrency(row[bidIndex]),
            rawBidAmount: parseFloat(row[bidIndex]) || 0
        }));

    // Calculate total bid amount
    const totalBid = players.reduce((sum, player) => sum + player.rawBidAmount, 0);

    return {
        teamName: teamName.toUpperCase(),
        players: players,
        totalBid: formatCurrency(totalBid),
        remainingBid: formatCurrency(remainingBidAmount),
        playerCount: players.length,
        headers: headers
    };
}

// Display all teams on the page
function displayTeams() {
    const container = document.getElementById('teamsContainer');
    container.innerHTML = '';

    if (teamsData.length === 0) {
        container.innerHTML = '<div class="no-data">No team data available</div>';
        return;
    }

    teamsData.forEach(team => {
        const teamCard = createTeamCard(team);
        container.appendChild(teamCard);
    });
}

// Create HTML card for a team
function createTeamCard(team) {
    const card = document.createElement('div');
    card.className = 'team-card';

    // Team header
    const header = document.createElement('div');
    header.className = 'team-header';
    header.innerHTML = `
        <div class="team-name">${team.teamName}</div>
        <div class="team-stats">
            Players: ${team.playerCount} | Total Bid: ${team.totalBid} | Remaining Bid: ${team.remainingBid}
        </div>
    `;

    // Players table
    const tableContainer = document.createElement('div');
    tableContainer.className = 'players-table';

    const table = document.createElement('table');

    // Table header
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>#</th>
            <th>Player Name</th>
            <th>Bid Amount</th>
        </tr>
    `;

    // Table body
    const tbody = document.createElement('tbody');
    team.players.forEach((player, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${player.name}</td>
            <td>${player.bidAmount}</td>
        `;
        tbody.appendChild(row);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    tableContainer.appendChild(table);

    card.appendChild(header);
    card.appendChild(tableContainer);

    return card;
}

// Helper function to format currency
function formatCurrency(value) {
    if (!value && value !== 0) return '-';
    const num = parseFloat(value);
    if (isNaN(num)) return '-';

    // Format as Indian currency (lakhs/crores)
    if (num >= 10000000) {
        return `₹${(num / 10000000).toFixed(2)} Cr`;
    } else if (num >= 100000) {
        return `₹${(num / 100000).toFixed(2)} L`;
    } else {
        return `₹${num.toLocaleString('en-IN')}`;
    }
}

// Show/hide loading indicator
function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
    document.getElementById('teamsContainer').style.display = show ? 'none' : 'grid';
}

// Show error message
function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

// Hide error message
function hideError() {
    document.getElementById('error').style.display = 'none';
}

// Update last updated time
function updateLastUpdatedTime() {
    const now = new Date();
    const timeString = now.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
    document.getElementById('lastUpdated').textContent = `Last Updated: ${timeString}`;
}


