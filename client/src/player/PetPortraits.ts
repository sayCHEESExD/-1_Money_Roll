import { PETS, type PetDefinition } from '@money/shared';
import { AmbientLight, DirectionalLight, HemisphereLight, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { buildPetModel } from './PetFollowers.js';

const SIZE = 160;

/**
 * PORTRAITS OF THE PETS FOR THE MENUS, rendered from the very models that
 * follow players in the world - so the card in the egg card and the pet in
 * the grass are the same pet.
 *
 * All twelve are drawn once, on the first request, with a small renderer of
 * their own on a transparent canvas, and the renderer is thrown away as soon
 * as they are done: twelve tiny renders cost nothing, a second WebGL context
 * kept alive would. The results are data URLs, cached for the session.
 */
class PetPortraits {
  private readonly cache = new Map<string, string>();
  private rendered = false;

  /** A data URL for this pet, or '' if WebGL is unavailable. */
  get(pet: PetDefinition): string {
    if (!this.rendered) this.renderAll();
    return this.cache.get(pet.id) ?? '';
  }

  private renderAll(): void {
    this.rendered = true;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    } catch {
      return;
    }
    renderer.setSize(SIZE, SIZE, false);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);

    const scene = new Scene();
    scene.add(new HemisphereLight(0xbfe3ff, 0x3a6b2a, 1.1));
    scene.add(new AmbientLight(0xffffff, 0.45));
    const sun = new DirectionalLight(0xfff4dc, 2.0);
    sun.position.set(2.5, 4, 3);
    scene.add(sun);

    const camera = new PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(2.6, 2.3, 3.6);
    camera.lookAt(0, 0.85, 0.1);

    for (const pet of PETS) {
      const rig = buildPetModel(pet);
      rig.root.rotation.y = -0.35;
      scene.add(rig.root);
      renderer.render(scene, camera);
      try {
        this.cache.set(pet.id, renderer.domElement.toDataURL('image/png'));
      } catch {
        this.cache.set(pet.id, '');
      }
      scene.remove(rig.root);
    }

    renderer.dispose();
    renderer.forceContextLoss();
  }
}

export const petPortraits = new PetPortraits();
