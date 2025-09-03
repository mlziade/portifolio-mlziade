#!/usr/bin/env python3
"""
Temporary script to convert high-res profile picture to WebP versions.
This script creates WebP versions of the profile picture at different sizes.
"""

import os
import sys
import logging
from PIL import Image

logger = logging.getLogger('convert_profile_images')

def convert_to_webp(input_path: str, output_path: str, size: tuple = None, quality: int = 85) -> bool:
    """
    Convert image to WebP format.
    
    Args:
        input_path: Path to input image
        output_path: Path for output WebP image
        size: Optional tuple (width, height) to resize
        quality: WebP quality (0-100)
        
    Returns:
        True if successful, False otherwise
    """
    try:
        with Image.open(input_path) as img:
            # Convert to RGB if necessary (WebP doesn't support transparency in all cases)
            if img.mode in ('RGBA', 'LA', 'P'):
                # Create white background for transparency
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Resize if size specified
            if size:
                img = img.resize(size, Image.Resampling.LANCZOS)
            
            # Save as WebP
            img.save(output_path, 'WebP', quality=quality, optimize=True)
            logger.info(f"Created: {output_path} ({size or 'original size'})")
            return True
            
    except Exception as e:
        logger.error(f"Error converting {input_path}: {e}")
        return False

def main():
    """Main function to convert profile pictures."""
    # Paths
    static_dir = "static"
    input_file = os.path.join(static_dir, "profile_picture_high_res.png")
    
    # Check if input file exists
    if not os.path.exists(input_file):
        logger.error(f"Input file not found: {input_file}")
        logger.info("Make sure profile_picture_high_res.png exists in the static directory.")
        sys.exit(1)
    
    # Output files to create
    # Note: Higher resolution for crisp quality, especially on retina/high-DPI displays
    conversions = [
        # (output_filename, size, quality)
        ("profile_picture.webp", (220, 220), 92),  # Desktop: 2x resolution for retina
        ("profile_picture_140.webp", (280, 280), 92),  # Tablet: 2x resolution
        ("profile_picture_120.webp", (240, 240), 92),  # Mobile: 2x resolution  
        ("profile_picture_88.webp", (176, 176), 90),   # Legacy tablet: 2x resolution
        ("profile_picture_66.webp", (132, 132), 90),   # Legacy mobile: 2x resolution
    ]
    
    logger.info(f"Converting {input_file} to WebP versions...")
    logger.info("-" * 50)
    
    success_count = 0
    for filename, size, quality in conversions:
        output_path = os.path.join(static_dir, filename)
        if convert_to_webp(input_file, output_path, size, quality):
            success_count += 1
    
    logger.info("-" * 50)
    logger.info(f"Conversion complete! {success_count}/{len(conversions)} files created successfully.")
    
    if success_count == len(conversions):
        logger.info("All WebP versions created successfully!")
        logger.info("Next steps:")
        logger.info("1. Update your templates to use WebP versions")
        logger.info("2. Test the website to ensure images load correctly")
        logger.info("3. Delete this script when no longer needed")
    else:
        logger.warning(f"{len(conversions) - success_count} conversions failed. Check the errors above.")

if __name__ == "__main__":
    main()