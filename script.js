// Configuration - GitHub data source
const GITHUB_BASE_URL = 'https://raw.githubusercontent.com/ashwinbharadwajpr-bit/Karhada_Cricket/main';
const TEAM_NAMES = ['Bengaluru Gladiators', 'Crimson Warriors', 'Friends XI', 'Malnad Bulls', 'Mysore Karadas', 'SDP GC', 'Sanatan Strikers', 'UCCB'];

// Team colors for visual distinction
const TEAM_COLORS = {
  'Bengaluru Gladiators': '#FF6B6B',
  'Crimson Warriors': '#C92A2A',
  'Friends XI': '#4ECDC4',
  'Malnad Bulls': '#FFD93D',
  'Mysore Karadas': '#6BCB77',
  'SDP GC': '#4D96FF',
  'Sanatan Strikers': '#FF9F1C',
  'UCCB': '#9D4EDD'
};
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

// Load data for all teams from GitHub
async function loadAllTeamsData() {
    showLoading(true);
    hideError();
    teamsData = [];

    try {
        // Load each team's CSV file from GitHub
        for (const teamName of TEAM_NAMES) {
            try {
                const teamData = await loadTeamCSV(teamName);
                if (teamData) {
                    teamsData.push(teamData);
                }
            } catch (error) {
                console.error(`Error loading team ${teamName}:`, error);
                // Continue loading other teams even if one fails
            }
        }

        if (teamsData.length === 0) {
            throw new Error('No team data could be loaded. Please check your internet connection and try again.');
        }

        // Sort teams by name
        teamsData.sort((a, b) => a.teamName.localeCompare(b.teamName));

        displayTeams();
        updateLastUpdatedTime();
        showLoading(false);
    } catch (error) {
        showError(error.message);
        showLoading(false);
    }
}

// Load CSV file for a specific team from GitHub
async function loadTeamCSV(teamName) {
    const fileName = `${teamName}.csv`;
    const csvUrl = `${GITHUB_BASE_URL}/${encodeURIComponent(fileName)}`;

    try {
        console.log(`Fetching ${teamName} from GitHub...`);
        
        const response = await fetch(csvUrl);
        if (!response.ok) {
            throw new Error(`Failed to load ${fileName}: ${response.status}`);
        }

        const csvText = await response.text();
        const teamData = parseTeamData(teamName, csvText);
        
        if (teamData) {
            console.log(`✓ Loaded ${teamName}: ${teamData.players.length} players`);
            return teamData;
        } else {
            console.warn(`⚠ No valid data for ${teamName}`);
            return null;
        }
    } catch (error) {
        console.error(`Error loading ${fileName}:`, error);
        return null;
    }
}

// Parse a CSV line handling quoted fields
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

// Parse amount string to number
function parseAmount(amountStr) {
    if (!amountStr) return 0;
    
    // Remove all non-numeric characters except decimal point
    const cleaned = String(amountStr).replace(/[^\d.]/g, '');
    const num = parseFloat(cleaned);
    
    return isNaN(num) ? 0 : num;
}

// Parse CSV data into structured format
function parseTeamData(teamName, csvText) {
    try {
        const lines = csvText.trim().split('\n');
        
        if (lines.length < 2) {
            return null;
        }

        const headers = parseCSVLine(lines[0]);
        const players = [];
        let totalBudget = 0;
        let remainingBudget = 0;

        // Parse player rows
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values = parseCSVLine(line);
            
            // Check if this is the remaining budget line
            if (values[0] && values[0].toLowerCase().includes('remaining')) {
                remainingBudget = parseAmount(values[1]);
                continue;
            }

            // Check if this is the total budget line
            if (values[0] && values[0].toLowerCase().includes('total')) {
                totalBudget = parseAmount(values[1]);
                continue;
            }

            // Skip empty rows
            if (!values[0] || values[0].length === 0) {
                continue;
            }

            // Add valid player row
            const bidAmount = parseAmount(values[1]);
            if (values[0].length > 0) {
                players.push({
                    name: values[0],
                    bidAmount: bidAmount,
                    bidFormatted: formatCurrency(bidAmount)
                });
            }
        }

        // Calculate totals if not explicitly provided
        if (totalBudget === 0) {
            totalBudget = players.reduce((sum, p) => sum + p.bidAmount, 0);
        }
        if (remainingBudget === 0) {
            remainingBudget = 100000000 - totalBudget; // Default total budget
        }

        return {
            teamName,
            players,
            totalBudget,
            remainingBudget,
            color: TEAM_COLORS[teamName] || '#666666'
        };
    } catch (error) {
        console.error(`Error parsing data for ${teamName}:`, error);
        return null;
    }
}

// Display all teams
function displayTeams() {
    const container = document.getElementById('teamsContainer');
    
    if (teamsData.length === 0) {
        container.innerHTML = '<div class="no-data">No team data available</div>';
        return;
    }

    const teamsHTML = teamsData.map(team => createTeamCard(team)).join('');
    container.innerHTML = `<div class="teams-grid">${teamsHTML}</div>`;
}

// Create HTML for a team card
function createTeamCard(team) {
    const playersHTML = team.players.map((player, idx) => `
        <tr class="${idx % 2 === 0 ? 'even-row' : 'odd-row'}">
            <td>${player.name}</td>
            <td class="amount">${player.bidFormatted}</td>
        </tr>
    `).join('');

    const noPlayers = team.players.length === 0;

    return `
        <div class="team-card" style="border-top: 5px solid ${team.color}">
            <div class="team-header" style="background-color: ${team.color}">
                <h3 class="team-name">${team.teamName}</h3>
                <div class="team-stats">
                    <span class="stat">Players: ${team.players.length}</span>
                    <span class="stat">Total: ${formatCurrency(team.totalBudget)}</span>
                </div>
            </div>
            ${noPlayers ? 
                '<div class="no-data">No players data</div>' :
                `<div class="players-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Player Name</th>
                                <th>Bid Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${playersHTML}
                        </tbody>
                    </table>
                </div>`
            }
        </div>
    `;
}

// Helper function to format currency
function formatCurrency(num) {
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
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

// Hide error message
function hideError() {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
}

// Update last refresh time
function updateLastUpdatedTime() {
    const now = new Date();
    const timeString = now.toLocaleString('en-IN', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
    document.getElementById('lastUpdated').textContent = `Last Updated: ${timeString}`;
}
