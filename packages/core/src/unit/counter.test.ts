import { expect } from "chai";
import { Counter } from "../models/counter";

describe("Counter", () => {
  describe("constructor", () => {
    it("should initialize empty counter with empty items", () => {
      const counter = new Counter<string>([], (item) => item);
      expect(counter.size).to.equal(0);
    });

    it("should initialize counter with items using string key", () => {
      const items = ["apple", "banana", "apple", "cherry", "banana", "apple"];
      const counter = new Counter(items, (item) => item);

      expect(counter.size).to.equal(3);
      expect(counter.get("apple")).to.equal(3);
      expect(counter.get("banana")).to.equal(2);
      expect(counter.get("cherry")).to.equal(1);
    });

    it("should initialize counter with items using number key", () => {
      const items = [1, 2, 1, 3, 1, 2];
      const counter = new Counter(items, (item) => item);

      expect(counter.get(1)).to.equal(3);
      expect(counter.get(2)).to.equal(2);
      expect(counter.get(3)).to.equal(1);
    });

    it("should initialize counter with items using boolean key", () => {
      const items = [true, false, true, true, false];
      const counter = new Counter(items, (item) => item);

      expect(counter.get(true)).to.equal(3);
      expect(counter.get(false)).to.equal(2);
    });

    it("should initialize counter with complex objects using property key function", () => {
      const items = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
        { id: 1, name: "Alice" },
      ];
      const counter = new Counter(items, (item) => item.id);

      expect(counter.get(1)).to.equal(2);
      expect(counter.get(2)).to.equal(1);
    });
  });

  describe("add", () => {
    it("should increment count for existing key", () => {
      const counter = new Counter(["a"], (item) => item);
      expect(counter.get("a")).to.equal(1);

      counter.add("a");
      expect(counter.get("a")).to.equal(2);

      counter.add("a");
      expect(counter.get("a")).to.equal(3);
    });

    it("should initialize count to 1 for new key", () => {
      const counter = new Counter<string>([], (item) => item);
      expect(counter.has("x")).to.be.false;

      counter.add("x");
      expect(counter.get("x")).to.equal(1);
    });

    it("should handle adding multiple different items", () => {
      const counter = new Counter<string>([], (item) => item);

      counter.add("first");
      counter.add("second");
      counter.add("first");
      counter.add("third");

      expect(counter.size).to.equal(3);
      expect(counter.get("first")).to.equal(2);
      expect(counter.get("second")).to.equal(1);
      expect(counter.get("third")).to.equal(1);
    });

    it("should work with custom key function during add", () => {
      interface User {
        id: number;
        name: string;
      }

      const users: User[] = [];
      const counter = new Counter<User>(users, (u) => u.id);

      const user1 = { id: 1, name: "Alice" };
      const user2 = { id: 2, name: "Bob" };

      counter.add(user1);
      counter.add(user1);
      counter.add(user2);

      expect(counter.get(1)).to.equal(2);
      expect(counter.get(2)).to.equal(1);
    });
  });

  describe("Counter as Map", () => {
    it("should maintain Map interface methods", () => {
      const counter = new Counter(["a", "b", "a"], (item) => item);

      expect(counter.has("a")).to.be.true;
      expect(counter.has("c")).to.be.false;
      expect(counter.size).to.equal(2);
    });

    it("should allow iteration over entries", () => {
      const counter = new Counter(["x", "y", "x"], (item) => item);
      const entries = Array.from(counter.entries());

      expect(entries).to.have.lengthOf(2);
      expect(entries).to.deep.include(["x", 2]);
      expect(entries).to.deep.include(["y", 1]);
    });

    it("should allow iteration over keys", () => {
      const counter = new Counter(["a", "b", "a"], (item) => item);
      const keys = Array.from(counter.keys());

      expect(keys).to.have.lengthOf(2);
      expect(keys).to.include("a");
      expect(keys).to.include("b");
    });

    it("should allow iteration over values", () => {
      const counter = new Counter(["a", "b", "a"], (item) => item);
      const values = Array.from(counter.values());

      expect(values).to.have.lengthOf(2);
      expect(values).to.include(2);
      expect(values).to.include(1);
    });
  });

  describe("edge cases", () => {
    it("should handle empty string as key", () => {
      const counter = new Counter(["", "a", ""], (item) => item);
      expect(counter.get("")).to.equal(2);
      expect(counter.get("a")).to.equal(1);
    });

    it("should handle zero as key", () => {
      const counter = new Counter([0, 1, 0, 0], (item) => item);
      expect(counter.get(0)).to.equal(3);
      expect(counter.get(1)).to.equal(1);
    });

    it("should distinguish between false and 0", () => {
      const counter = new Counter<number | boolean>([0, false, 0, false], (item) => item);
      expect(counter.get(0)).to.equal(2);
      expect(counter.get(false)).to.equal(2);
    });

    it("should handle large counts", () => {
      const items = Array(1000).fill("same");
      const counter = new Counter(items, (item) => item);
      expect(counter.get("same")).to.equal(1000);
    });
  });
});
