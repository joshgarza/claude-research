---
date: 2026-03-14
topic: Look into hexagonal architecture
status: complete
tags: []
---

# Look into hexagonal architecture

## Context
This session investigated the prompt, "Look into hexagonal architecture". The goal was to clarify what the pattern actually requires, where it is useful, where it creates unnecessary indirection, and how current teams are applying it in practice.

## Findings

### What hexagonal architecture is, in the original sense
Hexagonal architecture is Alistair Cockburn's 2005 "Ports and Adapters" pattern. The core idea is not "draw a hexagon" or "split code into six pieces"; it is the inside/outside asymmetry. The application lives on the inside, external actors and technologies live on the outside, and all communication crosses explicit ports. Adapters translate between technology-specific protocols and the application's language. Cockburn's original motivation was practical: run the app without a UI or real database, keep business logic out of those edges, and make automated tests possible without provisioning the real world first ([Cockburn 2005](https://alistair.cockburn.us/hexagonal-architecture)).

Two details from the original article still matter and are often lost in simplified blog versions:

1. A port is a purposeful conversation, not "every interface in the codebase." Cockburn explicitly treats port count as a design choice and warns against both extremes, one giant port or hundreds of trivial ones ([Cockburn 2005](https://alistair.cockburn.us/hexagonal-architecture/)).
2. The pattern is symmetric at the architecture level, but in implementation it usually splits into driving/primary adapters and driven/secondary adapters. Driving adapters trigger use cases. Driven adapters are called by the application to reach databases, brokers, email, or other systems ([Cockburn 2005, application notes](https://alistair.cockburn.us/hexagonal-architecture/)).

The durable mental model is:

- Core domain and use-case logic know nothing about HTTP, SQL, queues, browsers, ORMs, or cloud SDKs.
- External technologies depend inward on the core's abstractions.
- The same use case can be exercised by production adapters, test adapters, CLI tools, batch jobs, or other applications.

### Relationship to clean architecture, onion architecture, and layering
Industry terminology is loose here. Microsoft's architecture guidance treats Hexagonal, Ports-and-Adapters, Onion, and Clean Architecture as the same family of dependency-inverting architectures, with business logic in the application core and infrastructure outside it ([Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/common-web-application-architectures)). That is directionally true and matches how many teams talk.

However, Cockburn's 2025 update draws a sharper distinction. He argues that Ports & Adapters only specifies two layers, inside and outside, and requires explicit ports for specific conversations. Any additional layering inside the outside world is your choice, not part of the pattern itself. He also distinguishes weak conformance from strong conformance: if your port is expressed in SQL or another external technology, you technically followed the pattern shape, but you still leaked technology into the core ([Cockburn 2025 update draft](https://alistaircockburn.com/hexarch%20v1.1b%20DIFFS%2020250420-1012%20paper%2Bepub.docx.pdf)).

Practical conclusion:

- Treat "hexagonal", "clean", and "onion" as close relatives in day-to-day discussion.
- Preserve the stricter hexagonal rule in implementation: the core should talk in application language, not transport or persistence language.
- Do not waste time debating diagram shape if dependency direction is still wrong.

### When hexagonal architecture is a good fit
AWS Prescriptive Guidance gives a useful applicability checklist. It recommends hexagonal architecture when you need a fully testable core, multiple client types sharing the same domain logic, periodic UI or database refreshes, or multiple input/output channels that would otherwise force business logic customization into edge code ([AWS pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/hexagonal-architecture.html)).

That maps well to real decision criteria:

- Use it when domain rules matter more than transport details.
- Use it when the same capability must be exposed through more than one entry point, for example REST plus jobs plus CLI plus events.
- Use it when infrastructure churn is likely, for example ORM migration, queue replacement, or UI rewrite.
- Use it when you need high-confidence unit tests around core behavior.
- Use it when doing modernization, because it creates seams around legacy dependencies.

It is a weaker fit when:

- The app is a thin CRUD wrapper over a single database and one API surface.
- The team will only ever have one real adapter per side and the domain behavior is minimal.
- The extra indirection will make a tiny codebase harder to read than the problem warrants.

AWS is explicit that the extra adapter layer is justified only if there are several inputs or outputs, or credible change over time. Otherwise, adapter code becomes maintenance overhead and can add latency ([AWS pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/hexagonal-architecture.html)).

### Current best practices for implementation

#### 1. Put the business model and use cases in the core
Microsoft's guidance places entities, domain services, interfaces, specifications, domain events, and application services in the Application Core, with infrastructure implementations outside it ([Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/common-web-application-architectures)). AWS's newer guidance uses `domain`, `entrypoints`, and `adapters`, but the same idea holds: the domain is the core and does not depend on other modules ([AWS best practices](https://docs.aws.amazon.com/prescriptive-guidance/latest/hexagonal-architectures/best-practices.html)).

Good rule: if a class becomes impossible to run without an HTTP request object, ORM entity manager, SDK client, or queue handle, it is probably not in the core anymore.

#### 2. Model ports in domain language, not technology language
Cockburn's 2025 update is unusually direct here: a "weak" implementation still leaks technology by expressing a port in SQL terms. A "strong" implementation expresses the port only in application language ([Cockburn 2025 update draft](https://alistaircockburn.com/hexarch%20v1.1b%20DIFFS%2020250420-1012%20paper%2Bepub.docx.pdf)).

Good:

```ts
interface Orders {
  save(order: Order): Promise<void>;
  findById(orderId: OrderId): Promise<Order | null>;
}
```

Weak:

```ts
interface OrderSqlGateway {
  executeInsert(sql: string, params: unknown[]): Promise<void>;
}
```

The first preserves the core's vocabulary. The second drags persistence concerns into the core and eliminates most of the payoff.

#### 3. Treat entry points and outbound integrations as separate adapter types
AWS's best-practices guide recommends a project structure with:

- `entrypoints` for primary adapters
- `domain` for domain logic and interfaces
- `adapters` for secondary adapters

It also recommends keeping infrastructure code in the same repository for cloud projects so application and IaC evolve together ([AWS best practices](https://docs.aws.amazon.com/prescriptive-guidance/latest/hexagonal-architectures/best-practices.html)). Their Lambda example uses that structure concretely, including `app/domain/ports`, `app/entrypoints/api`, adapter tests, domain tests, and end-to-end API tests ([AWS Lambda example](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/structure-a-python-project-in-hexagonal-architecture-using-aws-lambda.html)).

This is a better default than technology-first folders like `controllers/`, `services/`, `repositories/` scattered without a clear core boundary.

#### 4. Use a composition root
Microsoft calls out the startup layer as the composition root where interfaces are wired to implementations via dependency injection ([Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/common-web-application-architectures)). This matters because the core should declare the contract, but not decide which adapter gets plugged in.

Typical runtime composition:

```ts
const orders = new PostgresOrders(pool);
const payments = new StripePayments(stripe);
const placeOrder = new PlaceOrder(orders, payments);
```

The use case depends on ports, not on `pg` or Stripe.

#### 5. Start with tests against the core, then add adapter tests
AWS recommends TDD at the unit level first, using mocks for ports, then implementing real adapters. It also recommends BDD or feature-level tests through primary adapters for end-to-end acceptance ([AWS best practices](https://docs.aws.amazon.com/prescriptive-guidance/latest/hexagonal-architectures/best-practices.html)). Microsoft similarly separates unit testing of the Application Core from integration testing of infrastructure implementations ([Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/common-web-application-architectures)).

The testing pyramid for a hexagonal service usually looks like:

- Core domain/use-case tests, many and fast
- Adapter integration tests, focused on persistence or external protocols
- Shallow end-to-end tests through entry points

If a team adopts hexagonal architecture but still writes most tests through the HTTP layer, it is paying the abstraction cost without collecting the feedback-speed benefit.

#### 6. Enforce the boundary automatically
One emerging practice is to convert architectural rules into tests or lints instead of trusting code review memory. ArchUnit's current user guide includes an onion-architecture rule and explicitly treats Onion Architecture as also known as Hexagonal Architecture / Ports and Adapters ([ArchUnit User Guide](https://www.archunit.org/userguide/html/000_Index.html)). Its motivation page explains the real problem clearly: architecture diagrams decay unless the codebase checks them continuously ([ArchUnit motivation](https://www.archunit.org/motivation)).

For TypeScript codebases, the same idea can be applied with boundary linting tools. The official `eslint-plugin-boundaries` repo provides rules for defining allowed dependency directions between project element types such as modules, helpers, pages, or domain slices ([eslint-plugin-boundaries](https://github.com/javierbrea/eslint-plugin-boundaries)).

This is worth doing. The common failure mode is not "the team forgot the concept." It is "one urgent change let an adapter import another adapter or infrastructure type, and the erosion compounded."

### Concrete example in TypeScript
The following is a small but representative use-case flow:

```ts
type OrderId = string;

type PlaceOrderInput = {
  customerId: string;
  items: Array<{ sku: string; quantity: number; unitPriceCents: number }>;
};

class Order {
  static place(input: PlaceOrderInput): Order {
    const totalCents = input.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPriceCents,
      0,
    );
    return new Order(crypto.randomUUID(), input.customerId, totalCents, "pending");
  }

  constructor(
    readonly id: OrderId,
    readonly customerId: string,
    readonly totalCents: number,
    private status: "pending" | "paid",
  ) {}

  markPaid() {
    this.status = "paid";
  }
}

interface Orders {
  save(order: Order): Promise<void>;
}

interface Payments {
  charge(input: { orderId: OrderId; amountCents: number }): Promise<{ reference: string }>;
}

class PlaceOrder {
  constructor(
    private readonly orders: Orders,
    private readonly payments: Payments,
  ) {}

  async execute(input: PlaceOrderInput) {
    const order = Order.place(input);
    await this.payments.charge({ orderId: order.id, amountCents: order.totalCents });
    order.markPaid();
    await this.orders.save(order);
    return { orderId: order.id };
  }
}
```

Primary adapter:

```ts
export async function postOrdersHandler(req: Request, deps: { placeOrder: PlaceOrder }) {
  const body = (await req.json()) as PlaceOrderInput;
  const result = await deps.placeOrder.execute(body);
  return Response.json(result, { status: 201 });
}
```

Secondary adapter:

```ts
class PostgresOrders implements Orders {
  constructor(private readonly db: PgClient) {}

  async save(order: Order): Promise<void> {
    await this.db.query(
      "insert into orders (id, customer_id, total_cents) values ($1, $2, $3)",
      [order.id, order.customerId, order.totalCents],
    );
  }
}
```

What matters is not the language or framework. What matters is that `PlaceOrder` does not import HTTP or PostgreSQL details, and the adapters do not define business rules that should have stayed in `Order` or `PlaceOrder`.

### Trade-offs and failure modes

#### Benefit: technology swap and multi-channel reuse
AWS highlights the ability to add additional adapters to the same port, such as GraphQL alongside REST, without changing the port or business logic ([AWS pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/hexagonal-architecture.html)). This is the architecture's best-case scenario: a stable core with changing edges.

#### Benefit: faster, cheaper testing
Cockburn's original article and both AWS and Microsoft guidance all converge here. The biggest operational advantage is test isolation. Test the core without the UI, real DB, or deployed infrastructure ([Cockburn 2005](https://alistair.cockburn.us/hexagonal-architecture), [AWS best practices](https://docs.aws.amazon.com/prescriptive-guidance/latest/hexagonal-architectures/best-practices.html), [Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/common-web-application-architectures)).

#### Cost: indirection and extra code
The main downside is not conceptual purity, it is maintenance. More interfaces, more files, more wiring, more adapter tests, and more abstractions to keep honest. AWS explicitly notes maintenance overhead and possible latency ([AWS pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/hexagonal-architecture.html)).

#### Failure mode: fake abstraction
The most common bad version is "hexagonal in folder names only":

- ports mirror framework or SQL details
- domain services return ORM models directly
- controllers contain business rules
- adapters call each other sideways
- the only tests still run through HTTP

At that point the team has imported ceremony without getting decoupling.

#### Failure mode: over-porting
If every use case gets its own tiny "port" and every port gets a new interface, teams can create a codebase that is formally correct but harder to navigate than a modular layered monolith. Cockburn explicitly treats the number of ports as a design judgment rather than a fixed rule ([Cockburn 2005](https://alistair.cockburn.us/hexagonal-architecture/)).

### Emerging trends and current direction

#### 1. The pattern is converging with modular monolith practice
Microsoft still recommends this family of architectures as especially appropriate for non-trivial monolithic applications, not just distributed systems ([Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/common-web-application-architectures)). That matches broader modern practice: keep the deployment unit simple, but keep dependencies pointed inward.

#### 2. Cloud and serverless implementations are now first-class
AWS is not discussing hexagonal architecture as a theoretical enterprise diagram. It provides concrete patterns for Lambda, API Gateway, DynamoDB, local tests, and repo layout ([AWS Lambda example](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/structure-a-python-project-in-hexagonal-architecture-using-aws-lambda.html)). That is a sign of maturity: the pattern now has infrastructure-specific reference implementations.

#### 3. Boundary enforcement is becoming automated, not aspirational
ArchUnit's current release line and official docs emphasize architecture as executable rules, not slides ([ArchUnit User Guide](https://www.archunit.org/userguide/html/000_Index.html)). In Java this is already normalized. In TypeScript, lint-based boundary tooling is filling the same role ([eslint-plugin-boundaries](https://github.com/javierbrea/eslint-plugin-boundaries)).

#### 4. Cockburn is generalizing the idea beyond the original pattern
In 2022, Cockburn published "Component-plus-Strategy generalizes Ports-and-Adapters," framing hexagonal architecture as a specific instance of a broader component/strategy idea ([Cockburn 2022](https://alistaircockburn.com/Component%20plus%20strategy.pdf)). That matters because it reframes ports and adapters less as a dogmatic folder scheme and more as a reusable separation move: define a boundary explicitly, inject a collaborator that satisfies a protocol, and swap test doubles or production adapters at will.

### Practical recommendations
For a modern team, the best version of hexagonal architecture is opinionated but not maximalist:

1. Start with a modular monolith.
2. Put domain entities and use-case orchestration in a core package with zero framework imports.
3. Define only the ports that represent real business conversations.
4. Keep ports in domain language.
5. Implement adapters per technology at the edges.
6. Put all wiring in a composition root.
7. Test the core first, adapters second, full stack last.
8. Add automated boundary checks once the codebase is large enough that human review alone will drift.

If a codebase cannot explain why a given interface exists, that interface is probably accidental ceremony, not architecture.

## Open Questions
- For TypeScript-heavy teams, which boundary-enforcement tool ends up being the best long-term analogue to ArchUnit: ESLint boundaries rules, dependency-cruiser, custom TS program analysis, or a mix?
- In event-driven systems, where domain events are central, what is the cleanest line between "event publication as a port" and "messaging infrastructure leakage into the core"?
- How should teams balance hexagonal architecture with frameworks that already impose strong module systems, such as NestJS or Effect-based service graphs, without creating duplicate abstractions?

## Extracted Principles
- Created [principles/hexagonal-architecture.md](../principles/hexagonal-architecture.md) with reusable guidance on when to use hexagonal architecture, how to define ports, how to enforce boundaries, and how to structure testing.
