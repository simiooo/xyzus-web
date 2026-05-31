FROM golang:tip-alpine3.23 AS builder

RUN apk add --no-cache git

ENV GOPROXY=https://goproxy.cn/

WORKDIR /src
RUN git clone https://github.com/ultrazg/xyz.git .
RUN go mod tidy
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /xyz .

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /xyz /usr/local/bin/xyz

EXPOSE 23020

CMD ["xyz"]