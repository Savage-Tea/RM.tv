FROM rust:1.89-alpine AS builder
RUN apk add --no-cache musl-dev pkgconfig openssl-dev
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release 2>/dev/null || true
RUN rm -rf src
COPY src/ src/
COPY migrations/ migrations/
RUN cargo build --release

FROM alpine:3.22
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/target/release/rmtv-backend /usr/local/bin/rmtv-backend
EXPOSE 3000
CMD ["rmtv-backend"]
