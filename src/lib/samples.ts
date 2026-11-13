export const SAMPLE_JSON = `{
  "id": 1042,
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "active": true,
  "balance": 1520.75,
  "tags": ["admin", "math"],
  "address": { "street": "12 Analytical Way", "city": "London", "geo": { "lat": 51.5, "lng": -0.12 } },
  "orders": [
    { "id": 1, "total": 19.99, "items": [{ "sku": "A-1", "qty": 2 }] },
    { "id": 2, "total": 5, "items": [], "coupon": "WELCOME" }
  ],
  "manager": null
}`
export const SAMPLE_CSV = `id,name,email,age,active
1,Ada Lovelace,ada@example.com,36,true
2,"Grace ""Amazing"" Hopper",grace@example.com,85,true
3,Linus,,54,false`
export const SAMPLE_YAML = `server:
  port: 8080
  servlet:
    context-path: /api
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/app
    username: app
    password: s3cret
  jpa:
    hibernate:
      ddl-auto: validate
logging:
  level:
    root: INFO
    com.example: DEBUG
`
export const SAMPLE_YAML_B = `server:
  port: 9090
  servlet:
    context-path: /api
spring:
  datasource:
    url: jdbc:postgresql://db.prod:5432/app
    username: app
    password: different
  jpa:
    hibernate:
      ddl-auto: none
management:
  endpoints:
    web:
      exposure:
        include: health,info
`
export const SAMPLE_STACK = `2024-03-11 10:15:42.123 ERROR 4121 --- [nio-8080-exec-3] o.a.c.c.C.[.[.[/].[dispatcherServlet] : Servlet.service() threw exception
org.springframework.web.util.NestedServletException: Request processing failed; nested exception is org.springframework.dao.DataIntegrityViolationException: could not execute statement; SQL [n/a]; constraint [users_email_key]
	at org.springframework.web.servlet.FrameworkServlet.processRequest(FrameworkServlet.java:1014)
	at org.springframework.web.servlet.FrameworkServlet.doPost(FrameworkServlet.java:909)
	at javax.servlet.http.HttpServlet.service(HttpServlet.java:652)
	... 42 common frames omitted
Caused by: org.springframework.dao.DataIntegrityViolationException: could not execute statement; SQL [n/a]; constraint [users_email_key]
	at org.springframework.orm.jpa.vendor.HibernateJpaDialect.convertHibernateAccessException(HibernateJpaDialect.java:276)
	at com.example.service.UserService.create(UserService.java:58)
	at com.example.web.UserController.createUser(UserController.java:31)
	... 12 more
Caused by: org.hibernate.exception.ConstraintViolationException: could not execute statement
	at org.hibernate.exception.internal.SQLStateConversionDelegate.convert(SQLStateConversionDelegate.java:59)
	at org.hibernate.engine.jdbc.internal.JdbcCoordinatorImpl.executeUpdate(JdbcCoordinatorImpl.java:197)
	... 5 more
Caused by: org.postgresql.util.PSQLException: ERROR: duplicate key value violates unique constraint "users_email_key"
	at org.postgresql.core.v3.QueryExecutorImpl.receiveErrorResponse(QueryExecutorImpl.java:2676)
	at org.postgresql.jdbc.PgPreparedStatement.executeUpdate(PgPreparedStatement.java:136)`
