export class User {
  constructor({ id, name, email, role }) {
    if (new.target === User) {
      throw new Error("User is an abstract base class and cannot be instantiated directly.");
    }

    this.id = id;
    this.name = name;
    this.email = email;
    this.role = role;
  }

  getProfile() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      role: this.role
    };
  }
}
