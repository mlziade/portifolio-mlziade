"""
Game of Life engine implementation.

This module contains the core logic for Conway's Game of Life,
including cell checking and generation streaming functionality.
"""

import logging

logger = logging.getLogger('playground.game_of_life.engine')

def check_cell(x_pos: int, y_pos: int, cell_state: bool, grid: set[tuple[int, int]]) -> bool:    
    """
    Check if a cell should be alive or dead in the next generation.
    
    Args:
        x_pos: X coordinate of the cell
        y_pos: Y coordinate of the cell  
        cell_state: Current state of the cell (True if alive, False if dead)
        grid: Set of all currently alive cells as (x, y) tuples
        
    Returns:
        True if the cell should be alive in the next generation, False otherwise
    """
    # Count neighbors
    total = 0
    for i in range(-1, 2):
        for j in range(-1, 2):
            if i == 0 and j == 0:
                continue  # Skip the cell itself
            neighbor_pos = (x_pos + i, y_pos + j)
            if neighbor_pos in grid:
                total += 1

    if not cell_state:
        # Dead cell with exactly 3 neighbors becomes alive
        if total == 3:
            return True
        # Otherwise remains dead
        return False
    
    else:  # Cell is alive
        # Live cell with 2 or 3 neighbors survives
        if total == 2 or total == 3:
            return True
        # Otherwise dies
        return False


def play_game_of_life(initial_alive_cells: list[tuple[int, int]], max_generations: int = 1000) -> list[list[tuple[int, int]]]:
    """
    Core Game of Life logic that generates all generations from an initial state.
    
    Args:
        initial_alive_cells: List of (x, y) coordinates representing initially alive cells
        max_generations: Maximum number of generations to simulate (default: 1000)
        
    Returns:
        List of generations, where each generation is a list of (x, y) coordinates of alive cells
    """
    logger.debug(f"Starting Game of Life simulation with {len(initial_alive_cells)} initial cells, max {max_generations} generations")
    
    # The grid is a set of cells, with the key being a tuple of the x and y position of the cell
    # The middle of the grid is at (0, 0)
    grid: set[tuple[int, int]] = set()

    # Add the initial grid to the grid set
    for cell in initial_alive_cells:
        grid.add((cell[0], cell[1]))

    # Generate all generations and collect them
    generations = []
    
    # Start the game loop (limit to maximum generations)
    # This is to avoid infinite loops
    for generation in range(max_generations):
        # If the grid is empty, break the loop
        if len(grid) == 0:
            logger.debug(f"Game of Life ended at generation {generation}: no alive cells")
            generations.append([])
            break

        # Create a set to store the cells that have already been checked
        # So we don't check the same cell multiple times
        checked_cells = set()

        # Create a auxiliary grid
        aux_grid = set()

        # Iterate over the alive cells and its 8 neighbors
        for cell in grid:
            for i in range(-1, 2):
                for j in range(-1, 2):
                    # Current cell position being checked
                    current_cell_pos = (cell[0] + i, cell[1] + j)

                    # Check if the current cell position is already checked
                    # If it is, skip it
                    if current_cell_pos in checked_cells:
                        continue
                    else:
                        # Check the current cell
                        new_state = check_cell(
                            x_pos = current_cell_pos[0],
                            y_pos = current_cell_pos[1],
                            cell_state = current_cell_pos in grid, # False if the cell is not in the grid
                            grid = grid,
                        )

                        # If it is alive, add the current cell to the auxiliary grid,
                        if new_state:
                            aux_grid.add(current_cell_pos)

                        # Add the current cell to the checked cells set
                        checked_cells.add(current_cell_pos)

        # Update the grid with the new state
        grid = aux_grid

        # Add the current generation to our list
        generations.append(list(grid))

        # Check for oscillators or still lifes by comparing with previous generations
        if generation > 10:  # Only check after a few generations
            # Check if current state matches any of the last 10 states (for oscillators)
            current_state = set(grid)
            for i in range(1, min(11, generation + 1)):
                if i < len(generations) and set(generations[generation - i]) == current_state:
                    # Found a cycle, stop generating
                    logger.debug(f"Game of Life ended at generation {generation}: cycle detected (period {i})")
                    break
    
    logger.debug(f"Game of Life simulation completed with {len(generations)} total generations")
    return generations
