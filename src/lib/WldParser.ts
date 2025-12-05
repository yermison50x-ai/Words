import { BinaryStream } from './BinaryStream';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Placement3D {
  position: Vector3;
  rotation: Vector3;
}

export interface WldEntity {
  id: number;
  className: string;
  placement: Placement3D;
}

export interface WldBrush {
  id: number;
  sectors: WldSector[];
}

export interface WldSector {
  polygons: WldPolygon[];
}

export interface WldPolygon {
  vertices: Vector3[];
  textureMapping?: string;
}

export interface WldWorld {
  name: string;
  description: string;
  backgroundColor: number;
  entities: WldEntity[];
  brushes: WldBrush[];
  spawnFlags: number;
}

export class WldParser {
  private stream: BinaryStream;

  constructor(arrayBuffer: ArrayBuffer) {
    this.stream = new BinaryStream(arrayBuffer);
  }

  parse(): WldWorld {
    const world: WldWorld = {
      name: '',
      description: '',
      backgroundColor: 0x000000,
      entities: [],
      brushes: [],
      spawnFlags: 0
    };

    try {
      this.stream.expectChunkID('WRLD');

      this.readBrushes(world);

      this.readState(world);

      this.stream.expectChunkID('WEND');

      return world;
    } catch (error) {
      console.error('Error parsing WLD file:', error);
      throw error;
    }
  }

  private readBrushes(world: WldWorld): void {
    if (this.stream.peekChunkID().equals(new (this.stream as any).constructor.ChunkID('WLIF'))) {
      this.readWorldInfo(world);
    }
  }

  private readWorldInfo(world: WldWorld): void {
    try {
      this.stream.expectChunkID('WLIF');

      if (this.stream.peekChunkID().toString() === 'DTRS') {
        this.stream.expectChunkID('DTRS');
      }

      const nameLength = this.stream.readInt32();
      if (nameLength > 0 && nameLength < 1000) {
        world.name = this.stream.readString(nameLength);
      }

      world.spawnFlags = this.stream.readUInt32();

      const descLength = this.stream.readInt32();
      if (descLength > 0 && descLength < 10000) {
        world.description = this.stream.readString(descLength);
      }
    } catch (error) {
      console.warn('Could not read world info:', error);
    }
  }

  private readState(world: WldWorld): void {
    try {
      this.stream.expectChunkID('WSTA');

      const version = this.stream.readInt32();
      console.log('World state version:', version);

      if (this.stream.peekChunkID().toString() === 'WLIF') {
        this.readWorldInfo(world);
      }

      world.backgroundColor = this.stream.readUInt32();

    } catch (error) {
      console.warn('Could not fully read world state:', error);
    }
  }
}
