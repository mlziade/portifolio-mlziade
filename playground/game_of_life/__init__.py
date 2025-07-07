"""
Conway's Game of Life implementation package.

This package contains the core engine and utilities for running
Conway's Game of Life simulations.
"""

from .engine import check_cell, play_game_of_life

__all__ = ['check_cell', 'play_game_of_life']
