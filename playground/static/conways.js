// Get canvas element and its 2D drawing context
const canvas = document.getElementById("gridCanvas");
const ctx = canvas.getContext("2d");

// Set canvas dimensions to full window size
let width = window.innerWidth;
let height = window.innerHeight;
canvas.width = width;
canvas.height = height;

// Configuration variables
let CELL_SIZE = 20;      // Size of each cell in pixels (now variable for zooming)
const MIN_CELL_SIZE = 5;   // Minimum cell size for zoom out
const MAX_CELL_SIZE = 50;  // Maximum cell size for zoom in
const ZOOM_FACTOR = 1.1;   // How much to zoom per scroll event
let isDragging = false;    // Tracks if user is currently panning the grid
let dragStart = { x: 0, y: 0 }; // Starting point of drag operation
let pan = { x: 0, y: 0 };  // Current pan/offset position of the grid
let running = false;       // Whether simulation is running or paused
let animationTimeout = null; // For controlling animation delay
let animationDelay = 100;  // Default animation delay in ms

// Create tooltip element to show cell coordinates
const tooltip = document.createElement('div');
tooltip.id = 'cell-tooltip';
tooltip.style.position = 'absolute';
tooltip.style.display = 'none';
tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
tooltip.style.color = 'white';
tooltip.style.padding = '5px';
tooltip.style.borderRadius = '3px';
tooltip.style.fontSize = '14px';
tooltip.style.pointerEvents = 'none'; // Prevents tooltip from interfering with mouse events
document.body.appendChild(tooltip);

// Set to track which cells are alive (using string keys like "x,y")
let aliveCells = new Set();

// Convert x,y coordinates to string keys for the Set
function posToKey(x, y) {
  return `${x},${y}`;
}

// Convert string key back to x,y coordinate array
function keyToPos(key) {
  return key.split(',').map(Number);
}

// Convert Set of cells to array format needed for API
function getAliveCellsArray() {
  return Array.from(aliveCells).map(keyToPos);
}

// Render the grid and all alive cells
function drawGrid() {
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = "#333";

  // Calculate grid dimensions and starting positions
  const cols = Math.ceil(width / CELL_SIZE);
  const rows = Math.ceil(height / CELL_SIZE);
  const startX = -Math.floor(pan.x / CELL_SIZE) - 1;
  const startY = -Math.floor(pan.y / CELL_SIZE) - 1;

  // Draw vertical grid lines
  for (let i = 0; i <= cols + 2; i++) {
    const x = i * CELL_SIZE + pan.x % CELL_SIZE;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // Draw horizontal grid lines
  for (let i = 0; i <= rows + 2; i++) {
    const y = i * CELL_SIZE + pan.y % CELL_SIZE;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Draw the origin (0,0) cell in blue if it's not alive
  const originKey = posToKey(0, 0);
  if (!aliveCells.has(originKey)) {
    ctx.fillStyle = "#4da6ff";
    const originX = 0 * CELL_SIZE + pan.x;
    const originY = 0 * CELL_SIZE + pan.y;
    
    // Only draw if visible in viewport
    if (
      originX + CELL_SIZE >= 0 &&
      originY + CELL_SIZE >= 0 &&
      originX < width &&
      originY < height
    ) {
      ctx.fillRect(originX + 1, originY + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    }
  }

  // Draw all alive cells in green
  ctx.fillStyle = "#0f0";
  aliveCells.forEach(key => {
    const [x, y] = keyToPos(key);
    const screenX = x * CELL_SIZE + pan.x;
    const screenY = y * CELL_SIZE + pan.y;

    // Only draw cells visible in the viewport
    if (
      screenX + CELL_SIZE >= 0 &&
      screenY + CELL_SIZE >= 0 &&
      screenX < width &&
      screenY < height
    ) {
      ctx.fillRect(screenX + 1, screenY + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    }
  });
}

// Convert mouse coordinates to grid cell coordinates
function getMouseCell(evt) {
  const rect = canvas.getBoundingClientRect();
  const x = evt.clientX - rect.left - pan.x;
  const y = evt.clientY - rect.top - pan.y;
  return [Math.floor(x / CELL_SIZE), Math.floor(y / CELL_SIZE)];
}

// Toggle a cell between alive and dead states
function toggleCell(x, y) {
  const key = posToKey(x, y);
  if (aliveCells.has(key)) {
    aliveCells.delete(key);
  } else {
    aliveCells.add(key);
  }
}

// Update grid with new alive cells from the server
function updateGrid(cellsArray) {
  aliveCells = new Set();
  cellsArray.forEach(([x, y]) => {
    aliveCells.add(posToKey(x, y));
  });
  drawGrid();
}

// Clear all cells from the grid
function clearGrid() {
  // Stop simulation if running
  if (running) {
    stopSimulation();
  }
  
  // Clear all alive cells
  aliveCells = new Set();
  
  // Redraw the grid
  drawGrid();
  console.log("Grid cleared");
}

// Handle chunked game of life simulation
function startSimulation() {
  if (running) return;
  
  // Clear any pending animation
  if (animationTimeout) {
    clearTimeout(animationTimeout);
  }
  
  running = true;
    // Disable slider and input while running
  delaySlider.disabled = true;
  delayInput.disabled = true;
  
  // Prepare request data - the current alive cells
  const requestData = {
    alive_cells: getAliveCellsArray()
  };
  
  console.log("Starting simulation with cells:", requestData.alive_cells);
  
  // Make the API request to get all generations
  fetch('/playground/conways/stream/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestData)
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    if (!running) {
      console.log("Simulation stopped before processing data");
      return;
    }
    
    console.log("Received generations data:", data);
    
    // Process the generations sequentially with animation delay
    const generations = data.generations;
    let currentGeneration = 0;
      function playNextGeneration() {
      if (!running || currentGeneration >= generations.length) {
        console.log("Simulation complete or stopped");
        running = false;
        delaySlider.disabled = false;
        delayInput.disabled = false;
        return;
      }
      
      // Update grid with current generation
      updateGrid(generations[currentGeneration]);
      
      currentGeneration++;
      
      // Schedule next generation
      animationTimeout = setTimeout(() => {
        playNextGeneration();
      }, animationDelay);
    }
    
    // Start playing generations
    playNextGeneration();
  })  .catch(error => {
    console.error('Fetch error:', error);
    running = false;
    delaySlider.disabled = false;
    delayInput.disabled = false;
  });
}

// Stop the simulation
function stopSimulation() {
  running = false;
    // Enable slider and input when stopped
  delaySlider.disabled = false;
  delayInput.disabled = false;
  
  if (animationTimeout) {
    clearTimeout(animationTimeout);
    animationTimeout = null;
  }
  
  console.log("Simulation stopped");
}

// Mouse event handlers for panning and cell toggling
canvas.addEventListener("mousedown", e => {
  isDragging = true;
  dragStart = { x: e.clientX, y: e.clientY };
  canvas.style.cursor = "grabbing";
});

canvas.addEventListener("mouseup", e => {
  isDragging = false;
  canvas.style.cursor = "grab";
});

canvas.addEventListener("mousemove", e => {
  if (isDragging) {
    // Calculate how far the mouse moved since last position
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    
    // Update pan position
    pan.x += dx;
    pan.y += dy;
    
    // Update drag start position
    dragStart = { x: e.clientX, y: e.clientY };
    
    // Redraw with new pan position
    drawGrid();
    
    // Hide tooltip while dragging
    tooltip.style.display = 'none';
  } else {
    // Show current cell coordinates in tooltip
    const [x, y] = getMouseCell(e);
    tooltip.textContent = `[${x}, ${y}]`;
    tooltip.style.left = `${e.clientX + 10}px`; // Offset from cursor
    tooltip.style.top = `${e.clientY + 10}px`;
    tooltip.style.display = 'block';
  }
});

// Add mouseout event to hide tooltip when mouse leaves canvas
canvas.addEventListener("mouseout", () => {
  tooltip.style.display = 'none';
});

canvas.addEventListener("click", e => {
  if (!isDragging && !running) {
    // Toggle cell at clicked position (only when not running)
    const [x, y] = getMouseCell(e);
    toggleCell(x, y);
    drawGrid();
  }
});

// Handle window resizing
window.addEventListener("resize", () => {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
  drawGrid();
});

// Initialize delay slider and input
const delaySlider = document.getElementById("delaySlider");
const delayInput = document.getElementById("delayInput");
const delayValue = document.getElementById("delayValue");

// Update delay when slider changes
delaySlider.addEventListener("input", function() {
  animationDelay = parseInt(this.value);
  delayInput.value = animationDelay;
  delayValue.textContent = "ms";
});

// Update delay when text input changes
delayInput.addEventListener("input", function() {
  let value = parseInt(this.value);
  
  // Only validate if there's a valid number
  if (!isNaN(value)) {
    // Clamp value to valid range
    if (value < 10) value = 10;
    if (value > 3000) value = 3000;
    
    animationDelay = value;
    delaySlider.value = value;
    delayValue.textContent = "ms";
  }
});

// Handle validation when input loses focus
delayInput.addEventListener("blur", function() {
  let value = parseInt(this.value);
  
  // If invalid or empty, reset to current delay
  if (isNaN(value) || this.value === "") {
    this.value = animationDelay;
  } else {
    // Clamp to valid range and update display
    if (value < 10) value = 10;
    if (value > 3000) value = 3000;
    
    this.value = value;
    animationDelay = value;
    delaySlider.value = value;
    delayValue.textContent = "ms";
  }
});

// Button controls for starting/stopping simulation
document.getElementById("start").addEventListener("click", startSimulation);
document.getElementById("stop").addEventListener("click", stopSimulation);
document.getElementById("clear").addEventListener("click", clearGrid);
document.getElementById("center").addEventListener("click", centerGrid);

// Center grid function - positions (0,0) at the center of the screen
function centerGrid() {
  // Set pan to position (0,0) at the center of the viewport
  pan.x = Math.floor(width / 2);
  pan.y = Math.floor(height / 2);
  drawGrid();
  console.log("Grid centered");
}

// Handle zooming with mouse wheel
canvas.addEventListener("wheel", e => {
  e.preventDefault(); // Prevent page scrolling

  // Get mouse position before zoom
  const mouseX = e.clientX;
  const mouseY = e.clientY;
  
  // Get grid coordinates under mouse before zoom
  const gridX = (mouseX - pan.x) / CELL_SIZE;
  const gridY = (mouseY - pan.y) / CELL_SIZE;
  
  // Determine zoom direction
  const zoomIn = e.deltaY < 0;
  
  // Apply zoom
  if (zoomIn && CELL_SIZE < MAX_CELL_SIZE) {
    CELL_SIZE *= ZOOM_FACTOR;
  } else if (!zoomIn && CELL_SIZE > MIN_CELL_SIZE) {
    CELL_SIZE /= ZOOM_FACTOR;
  }
  
  // Clamp cell size to limits
  CELL_SIZE = Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, CELL_SIZE));
  
  // Adjust pan to keep mouse position fixed in the grid
  pan.x = mouseX - gridX * CELL_SIZE;
  pan.y = mouseY - gridY * CELL_SIZE;
  
  // Redraw with new zoom level
  drawGrid();
}, { passive: false });

// Initial setup
centerGrid();
drawGrid();
console.log("Conway's Game of Life initialized");

// Modal functionality
document.addEventListener('DOMContentLoaded', function() {
  const modal = document.getElementById('welcomeModal');
  const closeBtn = document.querySelector('.close');
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanels = document.querySelectorAll('.tab-panel');
  const infoButton = document.getElementById('infoButton');

  // Show modal on page load
  modal.style.display = 'block';

  // Function to show modal
  function showModal() {
    modal.style.display = 'block';
  }

  // Function to hide modal
  function hideModal() {
    modal.style.display = 'none';
  }

  // Show modal when info button is clicked
  infoButton.addEventListener('click', showModal);

  // Close modal when X is clicked
  closeBtn.addEventListener('click', hideModal);

  // Close modal when clicking outside of it
  window.addEventListener('click', function(event) {
    if (event.target === modal) {
      hideModal();
    }
  });

  // Close modal when pressing Escape key
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && modal.style.display === 'block') {
      hideModal();
    }
  });

  // Tab switching functionality
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const targetTab = this.getAttribute('data-tab');
      
      // Remove active class from all buttons and panels
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabPanels.forEach(panel => panel.classList.remove('active'));
      
      // Add active class to clicked button and corresponding panel
      this.classList.add('active');
      document.getElementById(targetTab).classList.add('active');
    });
  });
});