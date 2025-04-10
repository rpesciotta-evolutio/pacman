var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var ObjectId = require('mongodb').ObjectId;
var Database = require('../lib/database');
const { trace, context, SpanKind } = require('@opentelemetry/api');
const tracer = trace.getTracer('user-route');

// create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: false })

// middleware that is specific to this router
router.use(function timeLog (req, res, next) {
    console.log('Time: ', Date());
    next();
})

router.get('/id', function(req, res, next) {
    console.log('[GET /user/id]');
    const currentSpan = trace.getSpan(context.active());
    if (currentSpan) currentSpan.setAttribute('requires_db', true);

    Database.getDb(req.app, function(err, db) {
        if (err) return next(err);

        // Insert user ID and return back generated ObjectId
        var userId = 0;

        const insertSpan = tracer.startSpan('MongoDB insert user id', { kind: SpanKind.SERVER }, context.active());
        context.with(trace.setSpan(context.active(), insertSpan), () => {
            db.collection('userstats').insertOne({
                date: Date()
            }, {
                w: 'majority',
                j: true,
                wtimeout: 10000
            }, function(err, result) {
                if (err) {
                    console.log('failed to insert new user ID err =', err);
                    console.error(err);
                    insertSpan.recordException(err);
                    insertSpan.setStatus({ code: 2, message: 'Failed to insert new user ID' });
                    insertSpan.setAttribute('db.connection_error', true);
                } else {
                    insertSpan.setStatus({ code: 1, message: 'Success' });
                    userId = result.insertedId;
                    console.log('Successfully inserted new user ID = ', userId);
                }

                insertSpan.end();
                res.json(userId);
            });
        });
    });
});

router.post('/stats', urlencodedParser, function(req, res, next) {
    console.log('[POST /user/stats]\n',
                ' body =', req.body, '\n',
                ' host =', req.headers.host,
                ' user-agent =', req.headers['user-agent'],
                ' referer =', req.headers.referer);

    var userScore = parseInt(req.body.score, 10),
        userLevel = parseInt(req.body.level, 10),
        userLives = parseInt(req.body.lives, 10),
        userET = parseInt(req.body.elapsedTime, 10);

    const currentSpan = trace.getSpan(context.active());
    if (currentSpan) currentSpan.setAttribute('requires_db', true);

    Database.getDb(req.app, function(err, db) {
        if (err) return next(err);

        const updateSpan = tracer.startSpan('MongoDB update user stats', { kind: SpanKind.SERVER }, context.active());
        context.with(trace.setSpan(context.active(), updateSpan), () => {
            // Update live user stats
            db.collection('userstats').updateOne({
                    _id: new ObjectId(req.body.userId),
                }, { $set: {
                        cloud: req.body.cloud,
                        zone: req.body.zone,
                        host: req.body.host,
                        score: userScore,
                        level: userLevel,
                        lives: userLives,
                        elapsedTime: userET,
                        date: Date(),
                        referer: req.headers.referer,
                        user_agent: req.headers['user-agent'],
                        hostname: req.hostname,
                        ip_addr: req.ip
                    }, $inc: {
                        updateCounter: 1
                    }
                }, {
                    w: 'majority',
                    j: true,
                    wtimeout: 10000
                }, function(err, result) {
                    var returnStatus = '';

                    if (err) {
                        console.log('failed to update user stats err =', err);
                        console.error(err);
                        updateSpan.recordException(err);
                        updateSpan.setStatus({ code: 2, message: 'Failed to update user stats' });
                        updateSpan.setAttribute('db.connection_error', true);
                        returnStatus = 'error';
                    } else {
                        console.log('Successfully updated user stats');
                        updateSpan.setStatus({ code: 1, message: 'Success' });
                        returnStatus = 'success';
                    }

                    updateSpan.end();
                    res.json({
                        rs: returnStatus
                    });
            });
        });
    });
});

router.get('/stats', function(req, res, next) {
    console.log('[GET /user/stats]');

    const currentSpan = trace.getSpan(context.active());
    if (currentSpan) currentSpan.setAttribute('requires_db', true);

    Database.getDb(req.app, function(err, db) {
        if (err) return next(err);

        const findSpan = tracer.startSpan('MongoDB find user stats', { kind: SpanKind.SERVER }, context.active());
        context.with(trace.setSpan(context.active(), findSpan), () => {

            // Find all elements where the score field exists to avoid
            // undefined values
            var col = db.collection('userstats');
            col.find({ score: {$exists: true}}).sort([['_id', 1]]).toArray(function(err, docs) {
                var result = [];
                if (err) {
                    console.log('failed to find user stats err =', err);
                    console.error(err);
                    findSpan.recordException(err);
                    findSpan.setStatus({ code: 2, message: 'Failed to find user stats' });
                    findSpan.setAttribute('db.connection_error', true);
                    findSpan.end();
                    return next(err);
                }

                findSpan.setStatus({ code: 1, message: 'Success' });
                findSpan.end();
                docs.forEach(function(item, index, array) {
                    result.push({
                                    cloud: item['cloud'],
                                    zone: item['zone'],
                                    host: item['host'],
                                    score: item['score'],
                                    level: item['level'],
                                    lives: item['lives'],
                                    et: item['elapsedTime'],
                                    txncount: item['updateCounter']
                    });
                });

                res.json(result);
            });
        });
    });
});


module.exports = router;
