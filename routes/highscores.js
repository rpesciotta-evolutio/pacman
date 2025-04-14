var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var Database = require('../lib/database');
const { trace, context, SpanKind } = require('@opentelemetry/api');
const tracer = trace.getTracer('highscores-route');

// create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: false })

// middleware that is specific to this router
router.use(function timeLog (req, res, next) {
    console.log('Time: ', Date());
    next();
})

router.get('/list', urlencodedParser, function(req, res, next) {
    console.log('[GET /highscores/list]');

    const currentSpan = trace.getSpan(context.active());
    if (currentSpan) currentSpan.setAttribute('requires_db', true);

    Database.getDb(req.app, function(err, db) {
        if (err) {
            return next(err); // let Express handle other types of errors
        }

        const findSpan = tracer.startSpan('MongoDB find highscore', { kind: SpanKind.SERVER }, context.active());
        context.with(trace.setSpan(context.active(), findSpan), () => {
            // Retrieve the top 10 high scores wrapped in an OpenTelemetry span
            var col = db.collection('highscore');            
            col.find({}).sort([['score', -1]]).limit(10).toArray(function(err, docs) {
                if (err) {
                    findSpan.recordException(err);
                    findSpan.setStatus({ code: 2, message: 'Failed communication with the DB' });
                    findSpan.setAttribute('db.connection_error', true);
                    findSpan.end();
                    console.log('Error retrieving high scores:', err);
                    return next(err); // let Express handle other types of errors
                }

                findSpan.setStatus({ code: 1, message: 'Success' });
                findSpan.end();

                var result = [];
                docs.forEach(function(item, index, array) {
                    result.push({ name: item['name'], cloud: item['cloud'],
                                zone: item['zone'], host: item['host'],
                                score: item['score'] });
                });
                res.json(result);
            });
        });
    });
});

// Accessed at /highscores
router.post('/', urlencodedParser, function(req, res, next) {
    console.log('[POST /highscores] body =', req.body,
                ' host =', req.headers.host,
                ' user-agent =', req.headers['user-agent'],
                ' referer =', req.headers.referer);

    var userScore = parseInt(req.body.score, 10),
        userLevel = parseInt(req.body.level, 10);

    const currentSpan = trace.getSpan(context.active());
    if (currentSpan) currentSpan.setAttribute('requires_db', true);

    Database.getDb(req.app, function(err, db) {
        if (err) return next(err);

        const insertSpan = tracer.startSpan('MongoDB insert highscore', { kind: SpanKind.SERVER }, context.active());
        context.with(trace.setSpan(context.active(), insertSpan), () => {
            db.collection('highscore').insertOne({
                name: req.body.name,
                cloud: req.body.cloud,
                zone: req.body.zone,
                host: req.body.host,
                score: userScore,
                level: userLevel,
                date: Date(),
                referer: req.headers.referer,
                user_agent: req.headers['user-agent'],
                hostname: req.hostname,
                ip_addr: req.ip
            }, {
                w: 'majority',
                j: true,
                wtimeout: 10000
            }, function(err, result) {
                var returnStatus = '';
                if (err) {
                    insertSpan.recordException(err);
                    insertSpan.setStatus({ code: 2, message: 'Failed communication with the DB' });
                    insertSpan.setAttribute("db.connection_error", true);
                    console.log('Error inserting high score:', err);
                    returnStatus = 'error';
                } else {
                    console.log('Successfully inserted highscore');
                    insertSpan.setStatus({ code: 1, message: 'Success' });
                    returnStatus = 'success';
                }
                insertSpan.end();
                res.json({
                    name: req.body.name,
                    zone: req.body.zone,
                    score: userScore,
                    level: userLevel,
                    rs: returnStatus
                });
            });
        });
    });
});

module.exports = router;
