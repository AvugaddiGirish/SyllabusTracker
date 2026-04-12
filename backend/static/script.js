const API_BASE_URL = '/api';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('add-topic-form');
    const input = document.getElementById('topic-title');
    const topicsGrid = document.getElementById('topics-grid');
    const statsCounter = document.getElementById('stats-counter');
    const template = document.getElementById('topic-card-template');

    // Fetch and render initial topics
    fetchTopics();

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = input.value.trim();
        if (!title) return;

        try {
            const response = await fetch(`${API_BASE_URL}/topics`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ title, status: 'Not Started' })
            });

            if (response.ok) {
                const newTopic = await response.json();
                renderTopic(newTopic, true);
                input.value = '';
                updateStats();
            }
        } catch (error) {
            console.error('Error adding topic:', error);
            alert("Failed to connect to the backend server. Make sure Flask is running!");
        }
    });

    // Fetch topics from backend
    async function fetchTopics() {
        try {
            const response = await fetch(`${API_BASE_URL}/topics`);
            const topics = await response.json();
            
            topicsGrid.innerHTML = '';
            
            if (topics.length === 0) {
                showEmptyState();
            } else {
                topics.forEach(topic => renderTopic(topic));
            }
            updateStats();
        } catch (error) {
            console.error('Error fetching topics:', error);
            topicsGrid.innerHTML = `
                <div class="empty-state">
                    <h3>Connection Error</h3>
                    <p>Could not connect to the backend server at ${API_BASE_URL}. Ensure your Flask app is running.</p>
                </div>
            `;
        }
    }

    // Render a single topic card
    function renderTopic(topic, prepend = false) {
        // Remove empty state if present
        const emptyState = document.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.topic-card');
        
        card.dataset.id = topic.id;
        card.querySelector('.topic-title').textContent = topic.title;
        
        const select = card.querySelector('.status-select');
        select.value = topic.status;
        select.dataset.status = topic.status; // Set for styling
        
        // Handle Event Listeners for this specific card
        select.addEventListener('change', (e) => updateTopicStatus(topic.id, topic.title, e.target));
        
        const deleteBtn = card.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => deleteTopic(topic.id, card));

        if (prepend) {
            topicsGrid.prepend(clone);
        } else {
            topicsGrid.appendChild(clone);
        }
    }

    // Update status in backend
    async function updateTopicStatus(id, title, selectElement) {
        const newStatus = selectElement.value;
        const previousStatus = selectElement.dataset.status;

        // Optimistically update UI
        selectElement.dataset.status = newStatus;

        try {
            const response = await fetch(`${API_BASE_URL}/topics/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: title, status: newStatus })
            });

            if (!response.ok) {
                throw new Error('Failed to update');
            }
        } catch (error) {
            console.error('Error updating topic:', error);
            // Revert on failure
            selectElement.value = previousStatus;
            selectElement.dataset.status = previousStatus;
            alert("Failed to update status. Server might be down.");
        }
    }

    // Delete topic in backend
    async function deleteTopic(id, cardElement) {
        // Add fade out animation first
        cardElement.classList.add('fade-out');
        
        try {
            const response = await fetch(`${API_BASE_URL}/topics/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                // Wait for animation to finish then remove
                setTimeout(() => {
                    cardElement.remove();
                    updateStats();
                    if (document.querySelectorAll('.topic-card').length === 0) {
                        showEmptyState();
                    }
                }, 300); // 300ms matches css animation
            } else {
                throw new Error("Failed to delete");
            }
        } catch (error) {
            console.error('Error deleting topic:', error);
            cardElement.classList.remove('fade-out');
            alert("Failed to delete topic. Server might be down.");
        }
    }

    function showEmptyState() {
        topicsGrid.innerHTML = `
            <div class="empty-state fade-in">
                <h3>No Topics Yet</h3>
                <p>Add a topic above to start building your syllabus tracker.</p>
            </div>
        `;
    }

    function updateStats() {
        const count = document.querySelectorAll('.topic-card').length;
        statsCounter.textContent = `${count} Topic${count !== 1 ? 's' : ''}`;
    }
});
