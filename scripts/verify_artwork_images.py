#!/usr/bin/env python3
"""Verifica URLs de imágenes de obras de arte en el catálogo."""

import requests
from catalog import ARTWORKS, ROOMS

def verify_image_url(url: str) -> bool:
    """Verifica si una URL devuelve status 200."""
    try:
        response = requests.head(url, timeout=10, allow_redirects=True)
        return response.status_code == 200
    except Exception as e:
        print(f"Error verificando {url}: {e}")
        return False

def main():
    print("Verificando URLs de imágenes de obras...\n")
    
    failed_urls = []
    successful_urls = []
    
    for artwork in ARTWORKS:
        image_url = artwork.get('image', '')
        artwork_name = artwork.get('name', 'Unknown')
        
        if not image_url:
            print(f"⚠️  {artwork_name}: SIN URL")
            continue
        
        status = verify_image_url(image_url)
        if status:
            print(f"✓ {artwork_name}: {image_url}")
            successful_urls.append((artwork_name, image_url))
        else:
            print(f"✗ {artwork_name}: {image_url}")
            failed_urls.append((artwork_name, image_url))
    
    print(f"\n{'='*80}")
    print(f"Resumen: {len(successful_urls)} OK, {len(failed_urls)} FALLIDAS\n")
    
    if failed_urls:
        print("URLs que fallan:")
        for name, url in failed_urls:
            print(f"  - {name}: {url}")
    
    print(f"\n{'='*80}")
    print("\nVerificando URLs de imágenes de salas...\n")
    
    failed_room_urls = []
    successful_room_urls = []
    
    for room in ROOMS:
        image_url = room.get('image', '')
        room_name = room.get('name', 'Unknown')
        
        if not image_url:
            print(f"⚠️  {room_name}: SIN URL")
            continue
        
        status = verify_image_url(image_url)
        if status:
            print(f"✓ {room_name}: {image_url}")
            successful_room_urls.append((room_name, image_url))
        else:
            print(f"✗ {room_name}: {image_url}")
            failed_room_urls.append((room_name, image_url))
    
    print(f"\n{'='*80}")
    print(f"Resumen Salas: {len(successful_room_urls)} OK, {len(failed_room_urls)} FALLIDAS\n")
    
    if failed_room_urls:
        print("URLs de salas que fallan:")
        for name, url in failed_room_urls:
            print(f"  - {name}: {url}")

if __name__ == '__main__':
    main()
