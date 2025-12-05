export class ChunkID {
  id: string;

  constructor(id: string = "    ") {
    this.id = id.padEnd(4, ' ').substring(0, 4);
  }

  equals(other: ChunkID): boolean {
    return this.id === other.id;
  }

  toString(): string {
    return this.id;
  }
}

export class BinaryStream {
  private buffer: DataView;
  private position: number = 0;
  private littleEndian: boolean = true;

  constructor(arrayBuffer: ArrayBuffer) {
    this.buffer = new DataView(arrayBuffer);
  }

  getPosition(): number {
    return this.position;
  }

  setPosition(pos: number): void {
    this.position = pos;
  }

  seek(offset: number, origin: 'begin' | 'current' | 'end' = 'current'): void {
    switch (origin) {
      case 'begin':
        this.position = offset;
        break;
      case 'current':
        this.position += offset;
        break;
      case 'end':
        this.position = this.buffer.byteLength + offset;
        break;
    }
  }

  atEOF(): boolean {
    return this.position >= this.buffer.byteLength;
  }

  readUInt8(): number {
    const value = this.buffer.getUint8(this.position);
    this.position += 1;
    return value;
  }

  readInt8(): number {
    const value = this.buffer.getInt8(this.position);
    this.position += 1;
    return value;
  }

  readUInt16(): number {
    const value = this.buffer.getUint16(this.position, this.littleEndian);
    this.position += 2;
    return value;
  }

  readInt16(): number {
    const value = this.buffer.getInt16(this.position, this.littleEndian);
    this.position += 2;
    return value;
  }

  readUInt32(): number {
    const value = this.buffer.getUint32(this.position, this.littleEndian);
    this.position += 4;
    return value;
  }

  readInt32(): number {
    const value = this.buffer.getInt32(this.position, this.littleEndian);
    this.position += 4;
    return value;
  }

  readFloat32(): number {
    const value = this.buffer.getFloat32(this.position, this.littleEndian);
    this.position += 4;
    return value;
  }

  readFloat64(): number {
    const value = this.buffer.getFloat64(this.position, this.littleEndian);
    this.position += 8;
    return value;
  }

  readString(length: number): string {
    if (length < 0 || length > 1000000) {
      throw new Error(`Invalid string length: ${length} at position ${this.position}`);
    }
    if (this.position + length > this.buffer.byteLength) {
      throw new Error(`Cannot read ${length} bytes at position ${this.position}, buffer size is ${this.buffer.byteLength}`);
    }
    const bytes = new Uint8Array(this.buffer.buffer, this.position, length);
    this.position += length;
    return new TextDecoder().decode(bytes);
  }

  readCString(): string {
    let str = '';
    while (this.position < this.buffer.byteLength) {
      const char = this.buffer.getUint8(this.position++);
      if (char === 0) break;
      str += String.fromCharCode(char);
    }
    return str;
  }

  readChunkID(): ChunkID {
    const id = this.readString(4);
    return new ChunkID(id);
  }

  peekChunkID(): ChunkID {
    const currentPos = this.position;
    const id = this.readChunkID();
    this.position = currentPos;
    return id;
  }

  expectChunkID(expected: string): void {
    const chunkID = this.readChunkID();
    if (!chunkID.equals(new ChunkID(expected))) {
      throw new Error(`Expected chunk ID "${expected}" but found "${chunkID.toString()}"`);
    }
  }

  readChunkSize(): number {
    return this.readInt32();
  }

  readBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(this.buffer.buffer, this.position, length);
    this.position += length;
    return bytes;
  }

  getSize(): number {
    return this.buffer.byteLength;
  }
}
